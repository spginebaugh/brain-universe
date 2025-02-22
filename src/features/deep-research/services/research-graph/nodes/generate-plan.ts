import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { ResearchState, Section } from '../../../types/research';

const PLAN_TEMPLATE = `You are a research planning assistant. Your task is to create a structured plan for researching the topic: {topic}.

Create {numberOfMainSections} main sections that would comprehensively cover this topic.
For each section:
1. Provide a clear title
2. Write a brief description of what should be covered
3. List 2-3 subsection titles that would help organize the content

Format the response as a JSON array of sections, where each section has:
- title: string
- description: string
- subsectionTitles: string[]

Ensure the sections flow logically and cover the topic comprehensively.`;

export function generatePlanNode(model: ChatOpenAI) {
  const prompt = PromptTemplate.fromTemplate(PLAN_TEMPLATE);

  return RunnableSequence.from([
    // Extract relevant state
    (state: ResearchState) => ({
      topic: state.topic,
      numberOfMainSections: state.numberOfMainSections
    }),
    // Generate plan using the prompt
    prompt,
    model,
    // Parse the response and update state
    async (response): Promise<Partial<ResearchState>> => {
      const content = response.content;
      let sections: Section[];
      
      try {
        sections = JSON.parse(content);
      } catch (error: unknown) {
        const e = error as Error;
        throw new Error(`Failed to parse plan response: ${e.message}`);
      }

      return {
        sections,
        completedSections: [],
        section: null
      };
    }
  ]);
} 