import os
import logging
from dotenv import load_dotenv
from typing import Dict, Any

# Configure logging and load environment variables first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
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
from open_deep_research.state import CustomJSONEncoder

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
    logger.info(f"\n{'='*80}\nProcessing Event\n{'='*80}")
    logger.info(f"Raw event data: {json.dumps(event, indent=2, cls=CustomJSONEncoder)}")
    
    # Create base progress event
    progress_event = ProgressEvent(
        type="progress",
        session_id=session_id,
        content=None,
        sections=[],
        steps=[]
    )
    logger.info(f"Created base progress event: {progress_event.model_dump_json(indent=2)}")
    
    try:
        # Handle error events first
        if isinstance(event, dict) and "error" in event:
            error_event = ErrorEvent(
                type="error",
                session_id=session_id,
                error=event["error"]
            )
            logger.info(f"Generated error event: {error_event.model_dump_json(indent=2)}")
            return error_event.model_dump()
        
        # Handle interrupt events
        if '__interrupt__' in event:
            interrupt_data = event['__interrupt__']
            logger.info(f"Processing interrupt data: {interrupt_data}")
            if isinstance(interrupt_data, tuple):
                value = interrupt_data[0].value if hasattr(interrupt_data[0], 'value') else str(interrupt_data)
                resumable = interrupt_data[0].resumable if hasattr(interrupt_data[0], 'resumable') else True
                interrupt_event = InterruptEvent(
                    type="interrupt",
                    session_id=session_id,
                    value=value,
                    resumable=resumable,
                    requires_feedback=True
                )
                logger.info(f"Generated interrupt event: {interrupt_event.model_dump_json(indent=2)}")
                return interrupt_event.model_dump()
        
        # Handle generate_report_plan events
        if isinstance(event, dict) and 'sections' in event:
            logger.info("Processing sections event")
            sections = event['sections']
            logger.info(f"Number of sections: {len(sections)}")
            
            if not sections:
                error_event = ErrorEvent(
                    type="error",
                    session_id=session_id,
                    error="No sections were generated. Please try again with a different query."
                )
                logger.info(f"Generated error event for empty sections: {error_event.model_dump_json(indent=2)}")
                return error_event.model_dump()
            
            # Add step information
            progress_event.steps = [{
                "agentName": "Report Planner",
                "thought": "Generated initial report structure",
                "action": "Planning sections",
                "observation": f"Created {len(sections)} sections"
            }]
            
            # Convert sections to dict format
            progress_event.sections = []
            for section in sections:
                logger.info(f"Processing section: {section}")
                section_dict = {
                    'title': section.name,
                    'description': section.description,
                    'subsection_titles': section.subsection_titles
                }
                if section.content:
                    if isinstance(section.content, str):
                        section_dict['content'] = section.content
                    else:
                        section_dict['content'] = {
                            'overview': section.content.overview,
                            'subsections': {
                                k: {
                                    'title': v.title,
                                    'description': v.description,
                                    'content': v.content,
                                    'sources': [{'title': s.title, 'url': s.url} for s in v.sources]
                                } for k, v in section.content.subsections.items()
                            }
                        }
                progress_event.sections.append(section_dict)
                logger.info(f"Converted section to: {json.dumps(section_dict, indent=2)}")
            
            logger.info(f"Final progress event: {progress_event.model_dump_json(indent=2)}")
            return progress_event.model_dump()
        
        # Handle search events
        if isinstance(event, dict) and 'source_str' in event:
            logger.info("Processing search event")
            logger.info(f"Source string length: {len(event['source_str'])}")
            progress_event.steps = [{
                "agentName": "Web Researcher",
                "thought": "Searching for information",
                "action": "Web search",
                "observation": "Found relevant sources"
            }]
            logger.info(f"Generated search progress event: {progress_event.model_dump_json(indent=2)}")
            return progress_event.model_dump()
        
        # Handle section processing events
        if isinstance(event, dict) and 'section' in event:
            logger.info("Processing section event")
            section = event['section']
            logger.info(f"Section data: {section}")
            
            progress_event.steps = [{
                "agentName": "Section Writer",
                "thought": f"Processing section: {section.name}",
                "action": "Writing content",
                "observation": "Generated section content"
            }]
            
            # Convert section to dict format
            section_dict = {
                'title': section.name,
                'description': section.description,
                'subsection_titles': section.subsection_titles
            }
            if section.content:
                if isinstance(section.content, str):
                    section_dict['content'] = section.content
                else:
                    section_dict['content'] = {
                        'overview': section.content.overview,
                        'subsections': {
                            k: {
                                'title': v.title,
                                'description': v.description,
                                'content': v.content,
                                'sources': [{'title': s.title, 'url': s.url} for s in v.sources]
                            } for k, v in section.content.subsections.items()
                        }
                    }
            progress_event.sections = [section_dict]
            logger.info(f"Generated section progress event: {progress_event.model_dump_json(indent=2)}")
            return progress_event.model_dump()
        
        # Handle completed sections
        if isinstance(event, dict) and 'completed_sections' in event:
            logger.info("Processing completed sections event")
            sections = event['completed_sections']
            logger.info(f"Number of completed sections: {len(sections)}")
            progress_event.steps = [{
                "agentName": "Report Assembler",
                "thought": "Finalizing report sections",
                "action": "Assembling content",
                "observation": f"Completed {len(sections)} sections"
            }]
            logger.info(f"Generated completion progress event: {progress_event.model_dump_json(indent=2)}")
            return progress_event.model_dump()
        
        # Default progress event
        logger.info("Generating default progress event")
        progress_event.content = str(event) if event else None
        logger.info(f"Default progress event: {progress_event.model_dump_json(indent=2)}")
        return progress_event.model_dump()
        
    except Exception as e:
        logger.error(f"Error processing event: {str(e)}", exc_info=True)
        error_event = ErrorEvent(
            type="error",
            session_id=session_id,
            error=f"Error processing event: {str(e)}"
        )
        logger.info(f"Generated error event: {error_event.model_dump_json(indent=2)}")
        return error_event.model_dump()

def event_to_dict(event: Dict[str, Any]) -> Dict[str, Any]:
    """Convert event to JSON-serializable dictionary."""
    if not isinstance(event, dict):
        return {"error": str(event)}
        
    result = {}
    for key, value in event.items():
        if isinstance(value, (list, tuple)):
            result[key] = [item.to_json() if hasattr(item, 'to_json') else str(item) for item in value]
        elif hasattr(value, 'to_json'):
            result[key] = value.to_json()
        elif isinstance(value, dict):
            result[key] = event_to_dict(value)
        else:
            result[key] = str(value)
    return result

@app.post("/api/research")
async def research(request: ResearchRequest):
    try:
        session_id = str(uuid.uuid4())
        logger.info(f"\n{'='*80}\nStarting Research Session: {session_id}\n{'='*80}")
        logger.info(f"Request data: {request.model_dump_json(indent=2)}")
        
        session = session_store.create_session(session_id)
        logger.info(f"Created session with config: {json.dumps(session['thread'], indent=2)}")
        
        async def event_generator():
            try:
                logger.info(f"\n{'='*80}\nStarting Event Stream\n{'='*80}")
                # Initialize the full state with all required fields
                initial_state = {
                    "topic": request.query,
                    "number_of_main_sections": request.number_of_main_sections if hasattr(request, 'number_of_main_sections') else 6,
                    "sections": [],
                    "section": None,  # Initialize section as None
                    "search_iterations": 0,
                    "search_queries": [],
                    "source_str": "",
                    "completed_sections": [],
                    "report_sections_from_research": ""
                }
                logger.info(f"Initial state: {json.dumps(initial_state, indent=2)}")
                
                async for event in session["graph"].astream(
                    initial_state,
                    session["thread"]
                ):
                    try:
                        # Convert event to JSON-serializable dict
                        event_dict = event_to_dict(event)
                        logger.info(f"\n{'-'*80}\nReceived graph event: {json.dumps(event_dict, indent=2)}")
                        
                        if isinstance(event, dict):
                            try:
                                processed_event = process_event(event, session_id)
                                event_json = json.dumps(processed_event)
                                logger.info(f"Sending processed event: {event_json}")
                                yield f"data: {event_json}\n\n"
                            except Exception as e:
                                logger.error(f"Error processing event: {str(e)}", exc_info=True)
                                error_event = ErrorEvent(
                                    type="error",
                                    session_id=session_id,
                                    error=f"Error processing event: {str(e)}"
                                )
                                error_json = error_event.model_dump_json()
                                logger.info(f"Sending error event: {error_json}")
                                yield f"data: {error_json}\n\n"
                        else:
                            logger.warning(f"Received non-dict event: {event}")
                            error_event = ErrorEvent(
                                type="error",
                                session_id=session_id,
                                error="Invalid event format"
                            )
                            error_json = error_event.model_dump_json()
                            logger.info(f"Sending error event: {error_json}")
                            yield f"data: {error_json}\n\n"
                    except Exception as e:
                        logger.error(f"Error in event processing: {str(e)}", exc_info=True)
                        error_json = json.dumps({'error': str(e)})
                        logger.info(f"Sending error: {error_json}")
                        yield f"data: {error_json}\n\n"
            except Exception as e:
                logger.error(f"Error in event stream: {str(e)}", exc_info=True)
                error_json = json.dumps({'error': str(e)})
                logger.info(f"Sending error: {error_json}")
                yield f"data: {error_json}\n\n"
            finally:
                logger.info(f"\n{'='*80}\nEvent Stream Completed\n{'='*80}")
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