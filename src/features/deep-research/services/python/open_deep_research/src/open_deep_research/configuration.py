import os
from enum import Enum
from dataclasses import dataclass, fields
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from dataclasses import dataclass

DEFAULT_REPORT_STRUCTURE = """Each section of the learning roadmap should:
1. Focus on a specific sub-topic of the main topic
2. Include exactly 6 subsections that break down the topic logically
3. Each subsection must have:
   - A clear title
   - A brief description
   - Detailed content
   - Relevant sources"""

class SearchAPI(Enum):
    PERPLEXITY = "perplexity"
    TAVILY = "tavily"

class PlannerProvider(Enum):
    OPENAI = "openai"
    GROQ = "groq"

class WriterProvider(Enum):
    OPENAI = "openai"

@dataclass(kw_only=True)
class Configuration:
    """The configurable fields for the chatbot."""
    report_structure: str = DEFAULT_REPORT_STRUCTURE # Defaults to the default report structure
    number_of_queries: int = 2 # Number of search queries to generate per iteration
    max_search_depth: int = 2 # Maximum number of reflection + search iterations
    planner_provider: PlannerProvider = PlannerProvider.OPENAI  # Defaults to OpenAI as provider
    planner_model: str = "o3-mini" # Defaults to OpenAI o3-mini as planner model
    writer_provider: WriterProvider = WriterProvider.OPENAI # Defaults to OpenAI as provider
    writer_model: str = "o3-mini" # Defaults to OpenAI as writer model
    search_api: SearchAPI = SearchAPI.TAVILY # Default to TAVILY

    @classmethod
    def from_runnable_config(
        cls, config: Optional[RunnableConfig] = None
    ) -> "Configuration":
        """Create a Configuration instance from a RunnableConfig."""
        configurable = (
            config["configurable"] if config and "configurable" in config else {}
        )
        values: dict[str, Any] = {
            f.name: os.environ.get(f.name.upper(), configurable.get(f.name))
            for f in fields(cls)
            if f.init
        }
        return cls(**{k: v for k, v in values.items() if v})