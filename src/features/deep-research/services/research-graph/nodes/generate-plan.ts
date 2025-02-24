import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState, Section } from '../../../types/research';

// Template for creating the plan using research
const PLAN_TEMPLATE = `You are an expert technical writer helping to plan a learning roadmap for the topic: {topic}

Using the following research context:
{researchContext}

Create {numberOfMainSections} main sections that would comprehensively cover this topic.
For each section:
1. Provide a clear title
2. Section descriptions should be clear and concise
3. List exactly 6 subsection titles that would help organize the content

Ensure the sections flow logically and cover the topic comprehensively using insights from the research.

Format the response as a JSON array of sections, where each section has:
- title: string
- description: string
- subsectionTitles: string[]`;

export function generatePlanNode(model: ChatOpenAI) {
  const sectionJsonParser = new JsonOutputParser<Section[]>();
  const planPrompt = PromptTemplate.fromTemplate(PLAN_TEMPLATE);

  return RunnableSequence.from([
    // 1. Format research context
    (state: ResearchState) => {
      const researchContext = (state.researchResults || []).map(result => 
        `${result.title}\n${result.content}\n${result.url}`
      ).join('\n\n');

      return {
        topic: state.topic,
        numberOfMainSections: state.numberOfMainSections,
        researchContext
      };
    },

    // 2. Generate plan using research context
    async (input) => {
      const planChain = planPrompt.pipe(model).pipe(sectionJsonParser);
      const sections = await planChain.invoke(input);

      if (!Array.isArray(sections)) {
        throw new Error('Sections must be an array');
      }
      
      sections.forEach((section, index) => {
        if (!section.title || !section.description || !Array.isArray(section.subsectionTitles)) {
          throw new Error(`Invalid section structure at index ${index}`);
        }
        if (section.subsectionTitles.length !== 6) {
          throw new Error(`Section ${section.title} must have exactly 6 subsection titles`);
        }
      });

      return {
        sections,
        completedSections: [],
        section: null,
        content: JSON.stringify({
          outline: {
            sections: sections.map(s => ({
              title: s.title,
              description: s.description,
              subsectionTitles: s.subsectionTitles
            }))
          }
        })
      };
    }
  ]);
} 