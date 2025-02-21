from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class ResearchRequest(BaseModel):
    query: str = Field(description="The research query")
    number_of_main_sections: Optional[int] = Field(default=6, description="Number of main sections to generate")

class FeedbackRequest(BaseModel):
    session_id: str
    feedback: Any

class Source(BaseModel):
    title: str
    url: str

class TextSection(BaseModel):
    title: str
    description: str
    content: str
    sources: List[Source]

class SectionContent(BaseModel):
    overview: str = ""
    subsections: Dict[str, TextSection] = Field(default_factory=dict)

class Section(BaseModel):
    name: str
    description: str
    research: bool = True
    content: Union[str, SectionContent, None] = ""
    subsection_titles: List[str] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

class Sections(BaseModel):
    sections: List[Section] = Field(description="Sections of the report.")

class ResearchStep(BaseModel):
    agentName: str
    thought: str
    action: Optional[str] = None
    observation: Optional[str] = None

class ResearchSource(BaseModel):
    title: str
    url: str
    content: str

class BaseEvent(BaseModel):
    type: str
    session_id: str

class ProgressEvent(BaseEvent):
    type: str = "progress"
    content: Optional[str] = None
    sections: Optional[List[Dict[str, Any]]] = None
    steps: Optional[List[ResearchStep]] = None

class InterruptEvent(BaseEvent):
    type: str = "interrupt"
    value: str
    resumable: bool = True
    requires_feedback: bool = True

class ErrorEvent(BaseEvent):
    type: str = "error"
    error: str

class BaseResearchEvent(BaseModel):
    type: str
    session_id: Optional[str] = None

class DeepResearchResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

Section.model_rebuild()  # Required for recursive Pydantic models 