import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AgentInput, AgentOutput, SearchQueryResponse, SectionPlanResponse } from './types';
import { Section } from '../../../types/research';

const REPORT_PLANNER_QUERY_TEMPLATE = `You are an expert technical writer, helping to plan a learning roadmap. 

<Report topic>
{topic}
</Report topic>

<Task>
Your goal is to generate {numberOfQueries} search queries that will help gather comprehensive information for planning the learning roadmap sections. 

Requirements:
1. Queries should be related to the topic of the learning roadmap
2. Make queries specific enough to find high-quality, relevant sources
3. Cover the breadth needed for the learning roadmap structure`;

const REPORT_PLANNER_TEMPLATE = `You are an expert technical writer, helping to plan a learning roadmap.

<Topic>
The topic of the learning roadmap is:
{topic}
</Topic>

<Context>
Here is context to use to plan the sections of the learning roadmap: 
{context}
</Context>

<Task>
Generate a list of {numberOfMainSections} main sections for the learning roadmap.

Requirements:
1. Each section must have exactly 6 subsection titles
2. Section numbers must start at 1 and increment by 1
3. Section descriptions should be clear and concise
4. Subsection titles should logically break down the section topic`;

export const reportPlannerAgent = async (input: AgentInput): Promise<AgentOutput> => {
  const { state, model } = input;
  const steps: AgentOutput['steps'] = [];

  // First generate search queries
  const queryPrompt = PromptTemplate.fromTemplate(REPORT_PLANNER_QUERY_TEMPLATE);
  const queryChain = RunnableSequence.from([
    queryPrompt,
    model,
    async (response): Promise<SearchQueryResponse> => {
      return JSON.parse(response.content);
    }
  ]);

  const queryResult = await queryChain.invoke({
    topic: state.topic,
    numberOfQueries: state.numberOfMainSections
  });

  steps.push({
    agentName: 'Report Planner',
    thought: `Generating initial search queries for topic: ${state.topic}`,
    action: 'Generating search queries',
    observation: `Generated ${queryResult.queries.length} search queries`
  });

  // Then use search results to generate plan
  const planPrompt = PromptTemplate.fromTemplate(REPORT_PLANNER_TEMPLATE);
  const planChain = RunnableSequence.from([
    planPrompt,
    model,
    async (response): Promise<SectionPlanResponse> => {
      return JSON.parse(response.content);
    }
  ]);

  const planResult = await planChain.invoke({
    topic: state.topic,
    numberOfMainSections: state.numberOfMainSections,
    context: state.sourceStr || ''
  });

  steps.push({
    agentName: 'Report Planner',
    thought: `Creating section plan based on gathered information`,
    action: 'Generating section plan',
    observation: `Generated plan with ${planResult.sections.length} sections`
  });

  // Convert plan to sections
  const sections: Section[] = planResult.sections.map(section => ({
    title: section.name,
    description: section.description,
    subsectionTitles: section.subsection_titles
  }));

  return {
    state: {
      sections,
      searchQueries: queryResult.queries.map(q => q.query)
    },
    steps
  };
}; 