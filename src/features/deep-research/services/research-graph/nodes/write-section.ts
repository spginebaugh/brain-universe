import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { ResearchState, Section } from '../../../types/research';
import { SectionContentSchema } from '../agents/types';
import { z } from 'zod';

const WRITE_SECTION_TEMPLATE = `You are a research writer tasked with writing a section of a comprehensive report.

Section Information:
Title: {sectionTitle}
Description: {sectionDescription}
Subsections: {subsectionTitles}

Research Data:
{sourceData}

Write a comprehensive section that:
1. Starts with an overview of the main topic
2. Includes detailed subsections as specified
3. Incorporates relevant information from the research data
4. Maintains academic tone and factual accuracy

Each subsection must include:
- A clear title matching one from the provided subsection titles
- A brief description of the topics covered
- Detailed content with citations
- At least one relevant source with title and URL`;

export function writeSectionNode(model: ChatOpenAI) {
  type PrepareOutput = {
    sectionTitle: string;
    sectionDescription: string;
    subsectionTitles: string;
    sourceData: string;
    currentState: ResearchState;
  };

  const prompt = PromptTemplate.fromTemplate<PrepareOutput>(WRITE_SECTION_TEMPLATE);

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

  const processResponse = new RunnableLambda({
    func: (input: { response: z.infer<typeof SectionContentSchema>; currentState: ResearchState }) => {
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
    prompt.pipe(model.withStructuredOutput(SectionContentSchema, {
      name: "SectionContentGenerator",
      strict: true
    })),
    processResponse
  ]);
} 