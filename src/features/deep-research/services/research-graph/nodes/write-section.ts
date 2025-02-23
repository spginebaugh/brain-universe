import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState, Section, SectionContent } from '../../../types/research';

const WRITE_SECTION_TEMPLATE = `You are an expert technical teacher crafting a detailed lesson for one section of a learning roadmap.

Section Information:
Title: {sectionTitle}
Description: {sectionDescription}
Subsections: {subsectionTitles}

Research Data:
{sourceData}

Write a comprehensive section that:
1. Starts with an overview of the main topic (100-150 words)
2. Includes detailed subsections as specified
3. Incorporates relevant information from the research data
4. Maintains academic tone and factual accuracy

Each subsection must include:
- A clear title matching one from the provided subsection titles
- A brief description of the topics covered
- Detailed content with citations
- At least one relevant source with title and URL

Format the response as a JSON object with:
- overview: string (100-150 word overview)
- subsections: Record<string, {{
    title: string,
    description: string,
    content: string,
    sources: Array<{{ title: string, url: string }}>
}}>`

export function writeSectionNode(model: ChatOpenAI) {
  type PrepareOutput = {
    sectionTitle: string;
    sectionDescription: string;
    subsectionTitles: string;
    sourceData: string;
    currentState: ResearchState;
  };

  const prompt = PromptTemplate.fromTemplate<PrepareOutput>(WRITE_SECTION_TEMPLATE);
  const jsonParser = new JsonOutputParser<SectionContent>();

  const prepareData = new RunnableLambda({
    func: (state: ResearchState) => {
      if (!state.section || !state.sourceStr) {
        throw new Error('Missing section or source data');
      }

      return {
        sectionTitle: state.section.title,
        sectionDescription: state.section.description,
        subsectionTitles: state.section.subsectionTitles.join(', '),
        sourceData: state.sourceStr,
        currentState: state
      };
    }
  });

  // Transform the model output to include state
  const addState = new RunnableLambda({
    func: (input: { response: PrepareOutput; generated: SectionContent }) => ({
      response: input.generated,
      currentState: input.response.currentState
    })
  });

  const processResponse = new RunnableLambda({
    func: (input: { response: SectionContent; currentState: ResearchState }) => {
      const updatedSection: Section = {
        ...input.currentState.section!,
        content: input.response
      };

      return {
        section: null,
        completedSections: [...input.currentState.completedSections, updatedSection]
      };
    }
  });

  return RunnableSequence.from([
    prepareData,
    {
      response: new RunnableLambda({ func: (x: PrepareOutput) => x }),
      generated: prompt.pipe(model).pipe(jsonParser)
    },
    addState,
    processResponse
  ]);
} 