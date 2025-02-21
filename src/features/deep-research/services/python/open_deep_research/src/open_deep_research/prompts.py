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
report_planner_instructions="""I want a plan for a learning roadmap. 

<Task>
Generate a list of {number_of_main_sections} main sections for the learning roadmap.

Each main section should have the fields:

- Name - Name for this section of the learning roadmap.
- Description - Brief overview of the main topics covered in this section.
- Subsection_titles - A list of 6 titles for subsections for this main section.
- Content - The content of the section, which you will leave blank for now.

</Task>

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
"""

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

<Guidelines for writing>
1. If the existing section content is not populated, write a new section from scratch.
2. If the existing section content is populated, write a new section that synthesizes the existing section content with the new information.
3. Structure your response in JSON format as follows:
```json
{
  "mainText": "Brief overview of the entire section (100-150 words)",
  "sections": {
    "subsection1": {
      "title": "First Subsection Title",
      "description": "Brief overview of the topics covered in this subsection",
      "content": "Detailed content for first subsection (150-200 words)"
      "sources": [
        {
          "title": "Source Title",
          "url": "Source URL"
        }
      ]
    },
    "subsection2": {
      "title": "Second Subsection Title",
      "description": "Brief overview of the topics covered in this subsection",
      "content": "Detailed content for second subsection (150-200 words)",
      "sources": [
        {
          "title": "Source Title",
          "url": "Source URL"
        }
      ]
    },
    // ... repeat for all 6 subsections
  }
}
```
4. Each subsection's content should be self-contained and comprehensive.
</Guidelines for writing>

<Content style>
For both mainText and each subsection's content:
- No marketing language
- Technical focus
- Write in simple, clear language
- Start each section with the most important insight in **bold**
- Use short paragraphs (2-3 sentences max)
- You may include ONE structural element per section IF it helps clarify your point:
  * Either a focused table comparing 2-3 key items (using Markdown table syntax)
  * Or a short list (3-5 items) using proper Markdown list syntax:
    - Use `*` or `-` for unordered lists
    - Use `1.` for ordered lists
    - Ensure proper indentation and spacing
</Content style>


<Quality checks>
- mainText provides a clear overview (100-150 words)
- Each subsection is comprehensive (150-200 words)
- Each section starts with a bold insight
- Content is technically accurate and well-structured
- All subsections from the provided titles are included
- Sources are properly cited for each subsection
- JSON structure is valid and matches the template exactly
</Quality checks>
"""
