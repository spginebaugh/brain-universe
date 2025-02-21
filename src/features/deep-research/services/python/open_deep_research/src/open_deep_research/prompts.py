# Prompt to generate search queries to help with planning the learning roadmap
report_planner_query_writer_instructions="""You are an expert technical writer, helping to plan a learning roadmap. 

<Report topic>
{topic}
</Report topic>

<Report organization>
{report_organization}
</Report organization>

<Task>
Your goal is to generate {number_of_queries} search queries that will help gather comprehensive information for planning the learning roadmap sections. 

The queries should:

1. Be related to the topic of the learning roadmap
2. Help satisfy the requirements specified in the learning roadmap organization

Make the queries specific enough to find high-quality, relevant sources while covering the breadth needed for the learning roadmap structure.
</Task>"""

# Prompt to generate the learning roadmap plan
report_planner_instructions="""You are an expert technical writer, helping to plan a learning roadmap.

<Topic>
The topic of the learning roadmap is:
{topic}
</Topic>

<Report organization>
The learning roadmap should follow this organization: 
{report_organization}
</Report organization>

<Context>
Here is context to use to plan the sections of the learning roadmap: 
{context}
</Context>

<Task>
Generate a list of {number_of_main_sections} main sections for the learning roadmap.

You must output your response in JSON format that matches this schema exactly:

{{
  "type": "object",
  "properties": {{
    "sections": {{
      "type": "array",
      "description": "Array of sections for the learning roadmap",
      "items": {{
        "type": "object",
        "properties": {{
          "number": {{
            "type": "integer",
            "description": "Section number"
          }},
          "name": {{
            "type": "string",
            "description": "Section name"
          }},
          "description": {{
            "type": "string",
            "description": "Brief overview of the main topics covered in this section"
          }},
          "subsection_titles": {{
            "type": "array",
            "description": "List of exactly 6 subsection titles",
            "items": {{
              "type": "string"
            }},
            "minItems": 6,
            "maxItems": 6
          }}
        }},
        "required": ["number", "name", "description", "subsection_titles"]
      }}
    }}
  }},
  "required": ["sections"]
}}

Requirements:
1. Each section must have exactly 6 subsection titles
2. Section numbers must start at 1 and increment by 1
3. Section descriptions should be clear and concise
4. Subsection titles should logically break down the section topic
5. The output must be valid JSON that exactly matches the schema
</Task>"""

# Query writer instructions
query_writer_instructions="""You are an expert technical teacher crafting targeted web search queries that will gather comprehensive information for writing a detailed lesson for a section of a learning roadmap.

<Section topic>
{section_topic}
</Section topic>

<Subsection titles>
{subsection_titles}
</Subsection titles>

<Task>
When generating {number_of_queries} search queries, ensure they:
1. Cover different aspects of the topic (e.g., core features, real-world applications, technical architecture)
2. Include specific technical terms related to the topic
3. Target recent information by including year markers where relevant (e.g., "2024")
4. Look for comparisons or differentiators from similar technologies/approaches
5. Search for both official documentation and practical implementation examples
6. Address each subsection title specifically to ensure comprehensive coverage

Your queries should be:
- Specific enough to avoid generic results
- Technical enough to capture detailed implementation information
- Diverse enough to cover all aspects of the section plan and subsections
- Focused on authoritative sources (documentation, technical blogs, academic papers)
</Task>"""

# Section writer instructions
section_writer_instructions = """You are an expert technical teacher crafting a detailed lesson for one section of a learning roadmap.

<Section topic>
{section_topic}
</Section topic>

<Subsection titles>
{subsection_titles}
</Subsection titles>

<Existing section content (if populated)>
{section_content}
</Existing section content>

<Source material>
{context}
</Source material>

<Task>
Write a comprehensive section with an overview and 6 detailed subsections based on the provided information.

You must output your response in JSON format that matches this schema exactly:

{{
  "type": "object",
  "properties": {{
    "overview": {{
      "type": "string",
      "description": "A 100-150 word overview of the entire section"
    }},
    "subsections": {{
      "type": "array",
      "description": "Array of exactly 6 subsections",
      "items": {{
        "type": "object",
        "properties": {{
          "title": {{
            "type": "string",
            "description": "Title of the subsection"
          }},
          "description": {{
            "type": "string",
            "description": "Brief overview of the topics covered in this subsection"
          }},
          "content": {{
            "type": "string",
            "description": "Detailed content for subsection (150-200 words)"
          }},
          "sources": {{
            "type": "array",
            "description": "List of sources used in this subsection",
            "items": {{
              "type": "object",
              "properties": {{
                "title": {{
                  "type": "string",
                  "description": "Title of the source"
                }},
                "url": {{
                  "type": "string",
                  "description": "URL of the source"
                }}
              }},
              "required": ["title", "url"]
            }}
          }}
        }},
        "required": ["title", "description", "content", "sources"]
      }},
      "minItems": 6,
      "maxItems": 6
    }}
  }},
  "required": ["overview", "subsections"]
}}

Requirements:
1. Overview must be 100-150 words and provide a clear summary of the section
2. Each subsection must include:
   - A clear title matching one from the provided subsection titles
   - A brief description of the topics covered
   - Detailed content (150-200 words)
   - At least one relevant source with title and URL
3. Content should be:
   - Technical and accurate
   - Written in simple, clear language
   - Start with the most important insight in **bold**
   - Use short paragraphs (2-3 sentences max)
4. You may include ONE structural element per subsection:
   - Either a focused table comparing 2-3 key items
   - Or a short list (3-5 items)
5. The output must be valid JSON that exactly matches the schema
</Task>"""
