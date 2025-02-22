from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.chat_models import init_chat_model
from langchain_core.runnables import RunnableConfig
from langgraph.constants import Send
from langgraph.graph import START, END, StateGraph
from langgraph.types import interrupt, Command

from open_deep_research.state import ReportStateInput, ReportStateOutput, Sections, ReportState, SectionState, SectionOutputState, Queries, Section, TextSection, Source, SectionContent
from open_deep_research.prompts import report_planner_query_writer_instructions, report_planner_instructions, query_writer_instructions, section_writer_instructions
from open_deep_research.configuration import Configuration
from open_deep_research.utils import tavily_search_async, deduplicate_and_format_sources, format_sections, perplexity_search

import logging
import json
import os
from datetime import datetime
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create formatters and handlers
formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# File handler - use absolute paths
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parents[5]  # Go up to brainuniverse root
log_dir = project_root / "features" / "deep-research" / "services" / "python" / "output_logs"

try:
    # Create log directory if it doesn't exist
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate log filename with timestamp
    log_filename = f"deep_research_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    log_path = log_dir / log_filename
    
    # Create and add file handler
    file_handler = logging.FileHandler(log_path)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Log the start of the session and log file location
    logger.info(f"Starting new research session")
    logger.info(f"Log file created at: {log_path}")
    
except Exception as e:
    logger.error(f"Failed to setup file logging: {e}")
    logger.info("Continuing with console logging only")

# Set writer model
writer_model = init_chat_model(model=Configuration.writer_model, model_provider=Configuration.writer_provider.value)

def parse_queries(text: str) -> list[str]:
    """Parse search queries from JSON response"""
    try:
        response_data = json.loads(text)
        queries = []
        for query_data in response_data["queries"]:
            queries.append(query_data["query"])
        return queries
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        # Fallback to old parsing method for backward compatibility
        queries = []
        for line in text.split('\n'):
            line = line.strip()
            if line and not line.startswith(('#', '-', '*', '1.', '2.', '3.', '4.', '5.')):
                queries.append(line)
        return queries
    except KeyError as e:
        logger.error(f"Missing required field in response: {e}")
        raise
    except Exception as e:
        logger.error(f"Error processing response: {e}")
        raise

def parse_section_content(text: str, subsection_titles: list[str]) -> SectionContent:
    """Parse section content from JSON response"""
    try:
        # Clean the text of any control characters
        cleaned_text = "".join(char for char in text if char.isprintable() or char in ['\n', '\t', ' '])
        
        # Try to find JSON content if it's embedded in other text
        try:
            start_idx = cleaned_text.index('{')
            end_idx = cleaned_text.rindex('}') + 1
            cleaned_text = cleaned_text[start_idx:end_idx]
        except ValueError:
            logger.warning("Could not find JSON markers in response, using full text")
        
        logger.debug(f"Attempting to parse JSON: {cleaned_text}")
        response_data = json.loads(cleaned_text)
        
        # Create subsections dictionary
        subsections = {}
        for subsection_data in response_data["subsections"]:
            subsections[subsection_data["title"]] = TextSection(
                title=subsection_data["title"],
                description=subsection_data["description"],
                content=subsection_data["content"],
                sources=[
                    Source(title=source["title"], url=source["url"])
                    for source in subsection_data["sources"]
                ]
            )
            
        return SectionContent(
            overview=response_data["overview"],
            subsections=subsections
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Raw text: {text}")
        logger.error(f"Cleaned text: {cleaned_text}")
        raise
    except KeyError as e:
        logger.error(f"Missing required field in response: {e}")
        raise
    except Exception as e:
        logger.error(f"Error processing response: {e}")
        raise

async def generate_report_plan(state: ReportState, config: RunnableConfig):
    """Generate the report plan"""
    logger.info(f"\n{'='*80}\nGenerating Report Plan\n{'='*80}")
    logger.info(f"Input state: {state}")
    logger.info(f"Config: {config}")
    
    topic = state["topic"]
    number_of_main_sections = state.get("number_of_main_sections", 6)
    logger.info(f"Topic: {topic}")
    logger.info(f"Number of sections: {number_of_main_sections}")
    
    configurable = Configuration.from_runnable_config(config)
    logger.info(f"Configuration: {configurable}")
    report_structure = configurable.report_structure
    number_of_queries = configurable.number_of_queries

    if isinstance(report_structure, dict):
        report_structure = str(report_structure)

    # Generate search queries
    system_instructions_query = report_planner_query_writer_instructions.format(
        topic=topic, 
        report_organization=report_structure, 
        number_of_queries=number_of_queries
    )
    logger.info(f"Query generation instructions: {system_instructions_query}")
    
    query_response = writer_model.invoke([
        SystemMessage(content=system_instructions_query),
        HumanMessage(content="Generate search queries that will help with planning the sections of the report.")
    ])
    logger.info(f"Query generation response: {query_response.content}")
    
    query_list = parse_queries(query_response.content)
    logger.info(f"Parsed queries: {query_list}")

    # Web search
    if isinstance(configurable.search_api, str):
        search_api = configurable.search_api
    else:
        search_api = configurable.search_api.value

    logger.info(f"Using search API: {search_api}")
    if search_api == "tavily":
        search_results = await tavily_search_async(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=1000, include_raw_content=False)
    elif search_api == "perplexity":
        search_results = perplexity_search(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=1000, include_raw_content=False)
    else:
        raise ValueError(f"Unsupported search API: {configurable.search_api}")
    
    logger.info(f"Search results length: {len(source_str)}")

    # Format system instructions for sections
    system_instructions_sections = report_planner_instructions.format(
        topic=topic, 
        report_organization=report_structure, 
        context=source_str,
        number_of_main_sections=number_of_main_sections
    )
    logger.info(f"Section generation instructions: {system_instructions_sections}")

    # Set the planner provider and model
    if isinstance(configurable.planner_provider, str):
        planner_provider = configurable.planner_provider
    else:
        planner_provider = configurable.planner_provider.value
    
    planner_llm = init_chat_model(model=Configuration.planner_model, model_provider=planner_provider)
    logger.info(f"Using planner: {planner_provider} with model {Configuration.planner_model}")
    
    # Generate sections
    sections_response = planner_llm.invoke([
        SystemMessage(content=system_instructions_sections),
        HumanMessage(content="Generate the sections of the report.")
    ])
    logger.info(f"Section generation response: {sections_response.content}")
    
    # Parse JSON response
    try:
        response_data = json.loads(sections_response.content)
        sections = []
        
        for section_data in response_data["sections"]:
            section = Section(
                name=section_data["name"],
                description=section_data["description"],
                research=True,
                content="",
                subsection_titles=section_data["subsection_titles"]
            )
            sections.append(section)
            logger.info(f"Added section: {section}")
            
        logger.info(f"Total sections generated: {len(sections)}")
        
        # If no sections were generated, return an error
        if not sections:
            logger.error("No sections were generated")
            return Command(
                update={"error": "No sections were generated. Please try again with a different query."},
                goto=END
            )

        # Initialize the first section for processing
        initial_state = {
            "sections": sections,
            "section": sections[0],
            "search_iterations": 0,
            "search_queries": [],
            "source_str": "",
            "report_sections_from_research": "",
            "completed_sections": []
        }
        logger.info(f"Returning initial state: {initial_state}")
        return Command(
            update=initial_state,
            goto="build_section_with_web_research"
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        return Command(
            update={"error": f"Failed to parse response: {str(e)}. Please try again."},
            goto=END
        )
    except KeyError as e:
        logger.error(f"Missing required field in response: {e}")
        return Command(
            update={"error": f"Invalid response format - missing field: {str(e)}. Please try again."},
            goto=END
        )
    except Exception as e:
        logger.error(f"Error processing response: {e}")
        return Command(
            update={"error": f"Error processing response: {str(e)}. Please try again."},
            goto=END
        )

def generate_queries(state: SectionState, config: RunnableConfig):
    """Generate search queries for a report section"""
    logger.info(f"\n{'='*80}\nGenerating Queries\n{'='*80}")
    logger.info(f"Input state: {state}")
    logger.info(f"Config: {config}")
    
    # Initialize state if needed
    section = state.get("section")
    if not section:
        logger.error("No section provided in state")
        return {"error": "No section provided in state"}
        
    configurable = Configuration.from_runnable_config(config)
    number_of_queries = configurable.number_of_queries

    # Format system instructions
    system_instructions = query_writer_instructions.format(
        section_topic=section.description, 
        number_of_queries=number_of_queries,
        subsection_titles="\n".join(section.subsection_titles)
    )
    logger.info(f"Query generation instructions: {system_instructions}")

    # Generate queries
    query_response = writer_model.invoke([
        SystemMessage(content=system_instructions),
        HumanMessage(content="Generate search queries on the provided topic.")
    ])
    logger.info(f"Query generation response: {query_response.content}")
    
    query_list = parse_queries(query_response.content)
    queries = [{"search_query": q} for q in query_list]
    logger.info(f"Generated queries: {queries}")

    # Return updated state
    return {
        "section": section,
        "sections": state.get("sections", []),
        "search_iterations": state.get("search_iterations", 0),
        "search_queries": queries,
        "source_str": state.get("source_str", ""),
        "completed_sections": state.get("completed_sections", [])
    }

async def search_web(state: SectionState, config: RunnableConfig):
    """Search the web for each query"""
    logger.info(f"\n{'='*80}\nSearching Web\n{'='*80}")
    logger.info(f"Input state: {state}")
    logger.info(f"Config: {config}")
    
    search_queries = state["search_queries"]
    configurable = Configuration.from_runnable_config(config)
    query_list = [query["search_query"] for query in search_queries]
    logger.info(f"Search queries: {query_list}")
    
    if isinstance(configurable.search_api, str):
        search_api = configurable.search_api
    else:
        search_api = configurable.search_api.value

    logger.info(f"Using search API: {search_api}")
    if search_api == "tavily":
        search_results = await tavily_search_async(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=5000, include_raw_content=True)
    elif search_api == "perplexity":
        search_results = perplexity_search(query_list)
        source_str = deduplicate_and_format_sources(search_results, max_tokens_per_source=5000, include_raw_content=False)
    else:
        raise ValueError(f"Unsupported search API: {configurable.search_api}")

    logger.info(f"Search results length: {len(source_str)}")
    
    # Return complete state
    return {
        "section": state["section"],
        "sections": state["sections"],
        "search_iterations": state["search_iterations"] + 1,
        "search_queries": state["search_queries"],
        "source_str": source_str,
        "completed_sections": state.get("completed_sections", []).copy()  # Return a copy of the list
    }

def write_section(state: SectionState, config: RunnableConfig):
    """Write a section of the report"""
    logger.info(f"\n{'='*80}\nWriting Section\n{'='*80}")
    logger.info(f"Input state: {state}")
    logger.info(f"Config: {config}")
    
    section = state["section"]
    source_str = state["source_str"]
    sections = state["sections"]
    configurable = Configuration.from_runnable_config(config)

    # Format system instructions
    system_instructions = section_writer_instructions.format(
        section_title=section.name, 
        section_topic=section.description, 
        context=source_str, 
        section_content=section.content if section.content else "",
        subsection_titles="\n".join(section.subsection_titles)
    )
    logger.info(f"Section writing instructions: {system_instructions}")

    # Generate section
    section_response = writer_model.invoke([
        SystemMessage(content=system_instructions),
        HumanMessage(content="Generate a report section based on the provided sources.")
    ])
    logger.info(f"Section generation response: {section_response.content}")
    
    # Parse the content into SectionContent model
    try:
        section.content = parse_section_content(section_response.content, section.subsection_titles)
        logger.info(f"Parsed section content: {section.content}")
    except Exception as e:
        logger.error(f"Error parsing section content: {e}", exc_info=True)
        section.content = section_response.content

    # Find the index of the current section
    current_index = next((i for i, s in enumerate(sections) if s.name == section.name), -1)
    completed_sections = state.get("completed_sections", []).copy()  # Make a copy of the list
    completed_sections.append(section)  # Add current section to completed list
    
    # Check if there are more sections to process
    if current_index < len(sections) - 1:
        # Move to next section
        next_section = sections[current_index + 1]
        logger.info(f"Moving to next section: {next_section.name}")
        return {
            "section": next_section,
            "sections": sections,
            "search_iterations": 0,
            "search_queries": [],
            "source_str": "",
            "completed_sections": completed_sections
        }
    else:
        # All sections complete
        logger.info("All sections completed")
        return {
            "section": section,
            "sections": sections,
            "search_iterations": state["search_iterations"],
            "search_queries": state["search_queries"],
            "source_str": state["source_str"],
            "completed_sections": completed_sections
        }

def write_final_sections(state: SectionState):
    """Write final sections of the report"""
    logger.info(f"\n{'='*80}\nWriting Final Sections\n{'='*80}")
    logger.info(f"Input state: {state}")
    
    section = state["section"]
    completed_report_sections = state["report_sections_from_research"]
    
    # Format system instructions
    system_instructions = section_writer_instructions.format(
        section_title=section.name, 
        section_topic=section.description, 
        context=completed_report_sections,
        section_content=section.content if section.content else "",
        subsection_titles="\n".join(section.subsection_titles)
    )
    logger.info(f"Final section writing instructions: {system_instructions}")

    # Generate section
    section_response = writer_model.invoke([
        SystemMessage(content=system_instructions),
        HumanMessage(content="Generate a report section based on the provided sources.")
    ])
    logger.info(f"Final section generation response: {section_response.content}")
    
    # Parse the content into SectionContent model
    try:
        section.content = parse_section_content(section_response.content, section.subsection_titles)
        logger.info(f"Parsed final section content: {section.content}")
    except Exception as e:
        logger.error(f"Error parsing final section content: {e}", exc_info=True)
        section.content = section_response.content

    return {"completed_sections": [section]}

def gather_completed_sections(state: ReportState):
    """Gather completed sections from research"""
    logger.info(f"\n{'='*80}\nGathering Completed Sections\n{'='*80}")
    logger.info(f"Input state: {state}")
    
    completed_sections = state["completed_sections"]
    completed_report_sections = format_sections(completed_sections)
    logger.info(f"Formatted sections length: {len(completed_report_sections)}")
    return {"report_sections_from_research": completed_report_sections}

# Report section sub-graph
section_builder = StateGraph(SectionState, output=SectionOutputState)

# Define simple entry point
section_builder.set_entry_point("generate_queries")

section_builder.add_node("generate_queries", generate_queries)
section_builder.add_node("search_web", search_web)
section_builder.add_node("write_section", write_section)

# Add edges for linear flow
section_builder.add_edge("generate_queries", "search_web")
section_builder.add_edge("search_web", "write_section")
section_builder.add_edge("write_section", END)

# Outer graph
builder = StateGraph(ReportState, input=ReportStateInput, output=ReportStateOutput, config_schema=Configuration)
builder.add_node("generate_report_plan", generate_report_plan)
builder.add_node("build_section_with_web_research", section_builder.compile())
builder.add_node("gather_completed_sections", gather_completed_sections)

# Add edges with proper state handling
builder.add_edge(START, "generate_report_plan")
builder.add_conditional_edges(
    "generate_report_plan",
    lambda x: END if "error" in x else "build_section_with_web_research"
)
builder.add_edge("build_section_with_web_research", "gather_completed_sections")
builder.add_edge("gather_completed_sections", END)

graph = builder.compile()