import os
import logging
from dotenv import load_dotenv
from typing import Dict, Any

# Configure logging and load environment variables first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

env_path = os.path.join(os.path.dirname(__file__), '.env')
logger.info(f"Loading environment from: {env_path}")
load_dotenv(env_path)

# Validate environment variables before imports
required_env_vars = ['TAVILY_API_KEY', 'OPENAI_API_KEY']
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Now we can safely import packages that need environment variables
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import uuid
from langgraph.checkpoint.memory import MemorySaver
from open_deep_research.graph import builder
from langgraph.types import Command

# Import our Pydantic models
from models import (
    ResearchRequest,
    FeedbackRequest,
    ProgressEvent,
    InterruptEvent,
    Section,
    ResearchStep,
    ResearchSource,
    ErrorEvent,
    TextSection,
    SectionContent
)

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SessionStore:
    def __init__(self):
        self._graphs = {}
        
    def create_session(self, session_id: str):
        if session_id in self._graphs:
            return self._graphs[session_id]
            
        # Create graph using open_deep_research builder
        logger.info(f"Creating new graph session: {session_id}")
        memory = MemorySaver()
        graph = builder.compile(checkpointer=memory)
        
        self._graphs[session_id] = {
            "graph": graph,
            "thread": {
                "configurable": {
                    "thread_id": session_id,
                    "search_api": "tavily",
                    "planner_provider": "openai",
                    "max_search_depth": 1,
                    "planner_model": "o3-mini",
                    "number_of_queries": 2,
                    "writer_model": "claude-3-sonnet-20240229"
                }
            }
        }
        return self._graphs[session_id]
        
    def get_session(self, session_id: str):
        return self._graphs.get(session_id)

session_store = SessionStore()

def process_event(event: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    """Process and format events from the graph for client consumption."""
    logger.info(f"Processing raw event: {event}")
    
    # Handle interrupt events
    if '__interrupt__' in event:
        interrupt_data = event['__interrupt__']
        if isinstance(interrupt_data, tuple):
            # Extract interrupt value and other properties
            value = interrupt_data[0].value if hasattr(interrupt_data[0], 'value') else str(interrupt_data)
            resumable = interrupt_data[0].resumable if hasattr(interrupt_data[0], 'resumable') else True
            return InterruptEvent(
                type="interrupt",
                session_id=session_id,
                value=value,
                resumable=resumable,
                requires_feedback=True
            ).model_dump()
    
    # Handle generate_report_plan events
    if 'generate_report_plan' in event:
        plan_data = event['generate_report_plan']
        if 'sections' in plan_data:
            return ProgressEvent(
                type="progress",
                session_id=session_id,
                sections=[{
                    'title': section.name,
                    'description': section.description,
                    'subsection_titles': section.subsection_titles
                } for section in plan_data['sections']]
            ).model_dump()
    
    # Handle completed sections
    if 'completed_sections' in event:
        sections_data = event['completed_sections']
        if isinstance(sections_data, list) and sections_data:
            formatted_sections = []
            for section in sections_data:
                if hasattr(section, 'content') and isinstance(section.content, SectionContent):
                    formatted_section = {
                        'title': section.name,
                        'description': section.description,
                        'mainText': section.content.mainText,
                        'subsections': [
                            {
                                'title': subsection.title,
                                'description': subsection.description,
                                'content': subsection.content,
                                'sources': [
                                    {'title': source.title, 'url': source.url}
                                    for source in subsection.sources
                                ]
                            }
                            for _, subsection in section.content.sections.items()
                        ]
                    }
                    formatted_sections.append(formatted_section)
            
            return ProgressEvent(
                type="progress",
                session_id=session_id,
                sections=formatted_sections
            ).model_dump()
    
    # Handle other progress events
    return ProgressEvent(
        type="progress",
        session_id=session_id,
        content=str(event) if event else None
    ).model_dump()

@app.post("/api/research")
async def research(request: ResearchRequest):
    try:
        session_id = str(uuid.uuid4())
        logger.info(f"Starting research for query: {request.query} with session: {session_id}")
        session = session_store.create_session(session_id)
        
        async def event_generator():
            try:
                logger.info("Starting event stream")
                async for event in session["graph"].astream(
                    {"topic": request.query},
                    session["thread"]
                ):
                    logger.info(f"Received event: {event}")
                    if isinstance(event, dict):
                        try:
                            # Process the event using our helper function
                            processed_event = process_event(event, session_id)
                            event_json = json.dumps(processed_event)
                            logger.info(f"Sending event: {event_json}")
                            yield f"data: {event_json}\n\n"
                        except Exception as e:
                            logger.error(f"Error processing event {event}: {str(e)}")
                            error_event = ErrorEvent(
                                type="error",
                                session_id=session_id,
                                error=f"Error processing event: {str(e)}"
                            )
                            yield f"data: {error_event.model_dump_json()}\n\n"
                    else:
                        logger.warning(f"Received non-dict event: {event}")
                        error_event = ErrorEvent(
                            type="error",
                            session_id=session_id,
                            error="Invalid event format"
                        )
                        yield f"data: {error_event.model_dump_json()}\n\n"
            except Exception as e:
                logger.error(f"Error in event stream: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                logger.info("Event stream completed")
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"Research error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/research/feedback")
async def provide_feedback(request: FeedbackRequest):
    try:
        logger.info(f"Processing feedback for session {request.session_id}: {request.feedback}")
        session = session_store.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session")

        async def event_generator():
            try:
                command = Command(resume=request.feedback)
                async for event in session["graph"].astream(
                    command,
                    session["thread"]
                ):
                    logger.info(f"Received feedback event: {event}")
                    if isinstance(event, dict):
                        try:
                            # Process the event using our helper function
                            processed_event = process_event(event, request.session_id)
                            event_json = json.dumps(processed_event)
                            logger.info(f"Sending feedback event: {event_json}")
                            yield f"data: {event_json}\n\n"
                        except Exception as e:
                            logger.error(f"Error processing feedback event {event}: {str(e)}")
                            error_event = ErrorEvent(
                                type="error",
                                session_id=request.session_id,
                                error=f"Error processing event: {str(e)}"
                            )
                            yield f"data: {error_event.model_dump_json()}\n\n"
                    else:
                        logger.warning(f"Received non-dict feedback event: {event}")
                        error_event = ErrorEvent(
                            type="error",
                            session_id=request.session_id,
                            error="Invalid event format"
                        )
                        yield f"data: {error_event.model_dump_json()}\n\n"
            except Exception as e:
                logger.error(f"Error in feedback event stream: {str(e)}")
                error_event = ErrorEvent(
                    type="error",
                    session_id=request.session_id,
                    error=str(e)
                )
                yield f"data: {error_event.model_dump_json()}\n\n"
            finally:
                logger.info("Feedback event stream completed")
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Feedback error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=2024)