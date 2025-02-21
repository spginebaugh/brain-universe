from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class ResearchSource(BaseModel):
    title: str
    url: str
    content: str

class Section(BaseModel):
    title: str
    content: str
    subsections: Optional[List['Section']] = None

class ResearchStep(BaseModel):
    agent_name: str = Field(..., alias="agentName")
    thought: str
    action: Optional[str] = None
    observation: Optional[str] = None

class BaseResearchEvent(BaseModel):
    type: str
    session_id: Optional[str] = None

class ErrorEvent(BaseResearchEvent):
    type: str = "error"
    error: str

class InterruptEvent(BaseResearchEvent):
    type: str = "interrupt"
    value: str
    resumable: bool
    requires_feedback: bool = True

class ProgressEvent(BaseResearchEvent):
    type: str = "progress"
    content: Optional[str] = None
    thought: Optional[str] = None
    action: Optional[str] = None
    observation: Optional[str] = None
    agent: Optional[str] = None
    source: Optional[Dict[str, str]] = None
    section: Optional[Section] = None
    sections: Optional[List[Section]] = None

Section.model_rebuild()  # Required for recursive Pydantic models

class ResearchRequest(BaseModel):
    query: str
    max_iterations: Optional[int] = Field(None, alias="maxIterations")
    context: Optional[str] = None

class FeedbackRequest(BaseModel):
    feedback: Union[bool, str]
    session_id: str = Field(..., alias="sessionId")

class DeepResearchResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None 