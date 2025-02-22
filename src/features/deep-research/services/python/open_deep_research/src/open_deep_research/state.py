from typing import Annotated, List, TypedDict, Literal, Optional, Union, Any
from pydantic import BaseModel, Field
import operator
import json

def merge_sections(left: 'Section', right: 'Section') -> 'Section':
    """Merge two sections, taking the newer content if available."""
    if not isinstance(left, Section) or not isinstance(right, Section):
        return right
    
    # If sections have different names, return the right one
    if left.name != right.name:
        return right
        
    # Merge the sections, preferring right's values
    return Section(
        name=right.name,
        description=right.description,
        research=right.research,
        content=right.content if right.content else left.content,
        subsection_titles=right.subsection_titles if right.subsection_titles else left.subsection_titles
    )

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, BaseModel):
            return obj.model_dump()
        if isinstance(obj, TypedDict):
            return dict(obj)
        return super().default(obj)

class BaseModelJSON(BaseModel):
    def to_json(self) -> dict[str, Any]:
        """Convert model to JSON-serializable dict."""
        return self.model_dump()
        
    def __str__(self) -> str:
        """String representation for logging."""
        return json.dumps(self.model_dump(), cls=CustomJSONEncoder)

class Source(BaseModelJSON):
    title: str = Field(description="Title of the source")
    url: str = Field(description="URL of the source")

class TextSection(BaseModelJSON):
    title: str = Field(description="Title of the subsection")
    description: str = Field(description="Brief overview of the topics covered in this subsection")
    content: str = Field(description="Detailed content for the subsection")
    sources: List[Source] = Field(description="List of sources used in this subsection")

class SectionContent(BaseModelJSON):
    overview: str = Field(description="Brief overview of the entire section")
    subsections: dict[str, TextSection] = Field(description="Dictionary of subsections with their content")

class Section(BaseModelJSON):
    name: str = Field(description="Name for this section of the report.")
    description: str = Field(description="Brief overview of the main topics and concepts to be covered in this section.")
    research: bool = Field(description="Whether to perform web research for this section of the report.")
    content: Union[str, SectionContent, None] = Field(default="", description="The content of the section in structured format")
    subsection_titles: List[str] = Field(description="List of subsection titles for this section", default_factory=list)

    def __str__(self) -> str:
        """String representation for logging."""
        return json.dumps({
            "name": self.name,
            "description": self.description,
            "research": self.research,
            "content": str(self.content) if isinstance(self.content, SectionContent) else self.content,
            "subsection_titles": self.subsection_titles
        }, cls=CustomJSONEncoder)

class Sections(BaseModelJSON):
    sections: List[Section] = Field(description="Sections of the report.")

class SearchQuery(BaseModelJSON):
    search_query: str = Field(description="Query for web search.")

class Queries(BaseModelJSON):
    queries: List[SearchQuery] = Field(description="List of search queries.")

class ReportStateInput(TypedDict):
    topic: str # Report topic
    number_of_main_sections: int # Number of main sections to generate
    
class ReportStateOutput(TypedDict):
    completed_sections: list[Section] # List of completed sections

class ReportState(TypedDict):
    topic: str # Report topic    
    number_of_main_sections: int # Number of main sections to generate
    sections: list[Section] # List of report sections 
    section: Annotated[Section, merge_sections] # Current section being processed
    search_iterations: int # Number of search iterations done
    search_queries: list[SearchQuery] # List of search queries
    source_str: str # String of formatted source content from web search
    completed_sections: Annotated[list[Section], operator.add] # List of completed sections
    report_sections_from_research: str # String of any completed sections from research to write final sections

class SectionState(TypedDict):
    section: Annotated[Section, merge_sections] # Report section with managed value annotation
    sections: list[Section] # List of report sections
    search_iterations: int # Number of search iterations done
    search_queries: list[SearchQuery] # List of search queries
    source_str: str # String of formatted source content from web search
    report_sections_from_research: str # String of any completed sections from research to write final sections
    completed_sections: Annotated[list[Section], operator.add] # Final key we duplicate in outer state for Send() API

class SectionOutputState(TypedDict):
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API
