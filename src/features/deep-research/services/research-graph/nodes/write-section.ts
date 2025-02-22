import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { ResearchState, Section, SectionContent } from '../../../types/research';

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

Format the response as a JSON object with:
{
  "overview": "string",
  "subsections": {
    "subsectionTitle": {
      "title": "string",
      "description": "string",
      "content": "string",
      "sources": [{"title": "string", "url": "string"}]
    }
  }
}`;

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
    func: (input: { response: string; currentState: ResearchState }) => {
      let sectionContent: SectionContent;
      
      try {
        sectionContent = JSON.parse(input.response);
      } catch (error: unknown) {
        const e = error as Error;
        throw new Error(`Failed to parse section content: ${e.message}`);
      }

      const updatedSection: Section = {
        ...input.currentState.section!,
        content: sectionContent
      };

      return {
        section: null,
        completedSections: [...input.currentState.completedSections, updatedSection]
      };
    }
  });

  return RunnableSequence.from([
    prepareData,
    prompt,
    model,
    processResponse
  ]);
} 