from typing import Annotated, List, TypedDict, Literal, Optional
from pydantic import BaseModel, Field
import operator

class Source(BaseModel):
    title: str = Field(description="Title of the source")
    url: str = Field(description="URL of the source")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "url": {"type": "string"}
            },
            "required": ["title", "url"],
            "additionalProperties": False
        }
    }

class TextSection(BaseModel):
    title: str = Field(description="Title of the subsection")
    description: str = Field(description="Brief overview of the topics covered in this subsection")
    content: str = Field(description="Detailed content for the subsection")
    sources: List[Source] = Field(description="List of sources used in this subsection")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "content": {"type": "string"},
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "url": {"type": "string"}
                        },
                        "required": ["title", "url"],
                        "additionalProperties": False
                    }
                }
            },
            "required": ["title", "description", "content", "sources"],
            "additionalProperties": False
        }
    }

class SectionContent(BaseModel):
    mainText: str = Field(description="Brief overview of the entire section")
    sections: dict[str, TextSection] = Field(description="Dictionary of subsections with their content")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "mainText": {"type": "string"},
                "sections": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "content": {"type": "string"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "url": {"type": "string"}
                                    },
                                    "required": ["title", "url"],
                                    "additionalProperties": False
                                }
                            }
                        },
                        "required": ["title", "description", "content", "sources"],
                        "additionalProperties": False
                    }
                }
            },
            "required": ["mainText", "sections"],
            "additionalProperties": False
        }
    }

class Section(BaseModel):
    name: str = Field(description="Name for this section of the report.")
    description: str = Field(description="Brief overview of the main topics and concepts to be covered in this section.")
    research: bool = Field(description="Whether to perform web research for this section of the report.")
    content: Optional[SectionContent] = Field(description="The content of the section in structured format")
    subsection_titles: List[str] = Field(description="List of subsection titles for this section", default_factory=list)

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "description": {"type": "string"},
                "research": {"type": "boolean"},
                "content": {
                    "type": "object",
                    "properties": {
                        "mainText": {"type": "string"},
                        "sections": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "description": {"type": "string"},
                                    "content": {"type": "string"},
                                    "sources": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "title": {"type": "string"},
                                                "url": {"type": "string"}
                                            },
                                            "required": ["title", "url"],
                                            "additionalProperties": False
                                        }
                                    }
                                },
                                "required": ["title", "description", "content", "sources"],
                                "additionalProperties": False
                            }
                        }
                    },
                    "required": ["mainText", "sections"],
                    "additionalProperties": False
                },
                "subsection_titles": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["name", "description", "research", "content", "subsection_titles"],
            "additionalProperties": False
        }
    }

class Sections(BaseModel):
    sections: List[Section] = Field(description="Sections of the report.")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "research": {"type": "boolean"},
                            "content": {
                                "type": "object",
                                "properties": {
                                    "mainText": {"type": "string"},
                                    "sections": {
                                        "type": "object",
                                        "additionalProperties": {
                                            "type": "object",
                                            "properties": {
                                                "title": {"type": "string"},
                                                "description": {"type": "string"},
                                                "content": {"type": "string"},
                                                "sources": {
                                                    "type": "array",
                                                    "items": {
                                                        "type": "object",
                                                        "properties": {
                                                            "title": {"type": "string"},
                                                            "url": {"type": "string"}
                                                        },
                                                        "required": ["title", "url"],
                                                        "additionalProperties": False
                                                    }
                                                }
                                            },
                                            "required": ["title", "description", "content", "sources"],
                                            "additionalProperties": False
                                        }
                                    }
                                },
                                "required": ["mainText", "sections"],
                                "additionalProperties": False
                            },
                            "subsection_titles": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "required": ["name", "description", "research", "content", "subsection_titles"],
                        "additionalProperties": False
                    }
                }
            },
            "required": ["sections"],
            "additionalProperties": False
        }
    }

class SearchQuery(BaseModel):
    search_query: str = Field(description="Query for web search.")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "search_query": {"type": "string"}
            },
            "required": ["search_query"],
            "additionalProperties": False
        }
    }

class Queries(BaseModel):
    queries: List[SearchQuery] = Field(description="List of search queries.")

    model_config = {
        "json_schema_extra": {
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "search_query": {"type": "string"}
                        },
                        "required": ["search_query"],
                        "additionalProperties": False
                    }
                }
            },
            "required": ["queries"],
            "additionalProperties": False
        }
    }

class ReportStateInput(TypedDict):
    topic: str # Report topic
    number_of_main_sections: int # Number of main sections to generate
    
class ReportStateOutput(TypedDict):
    final_report: str # Final report

class ReportState(TypedDict):
    topic: str # Report topic    
    number_of_main_sections: int # Number of main sections to generate
    sections: list[Section] # List of report sections 
    completed_sections: Annotated[list, operator.add] # Send() API key
    report_sections_from_research: str # String of any completed sections from research to write final sections
    final_report: str # Final report

class SectionState(TypedDict):
    section: Section # Report section  
    search_iterations: int # Number of search iterations done
    search_queries: list[SearchQuery] # List of search queries
    source_str: str # String of formatted source content from web search
    report_sections_from_research: str # String of any completed sections from research to write final sections
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API

class SectionOutputState(TypedDict):
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API
