import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AgentInput, AgentOutput, SearchQuerySchema } from './types';

const QUERY_WRITER_TEMPLATE = `You are an expert technical teacher crafting targeted web search queries that will gather comprehensive information for writing a detailed lesson for a section of a learning roadmap.

<Section topic>
{sectionTopic}
</Section topic>

<Subsection titles>
{subsectionTitles}
</Subsection titles>

<Task>
Your goal is to generate {numberOfQueries} search queries that will help gather comprehensive information for writing this section.

Requirements:
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
- Focused on authoritative sources (documentation, technical blogs, academic papers)`;

export const queryWriterAgent = async (input: AgentInput): Promise<AgentOutput> => {
  const { state, model } = input;
  const steps: AgentOutput['steps'] = [];

  if (!state.section) {
    throw new Error('No section provided for query generation');
  }

  const prompt = PromptTemplate.fromTemplate(QUERY_WRITER_TEMPLATE);
  const chain = RunnableSequence.from([
    prompt,
    model.withStructuredOutput(SearchQuerySchema, {
      name: "SearchQueryGenerator",
      strict: true
    })
  ]);

  const result = await chain.invoke({
    sectionTopic: state.section.title,
    subsectionTitles: state.section.subsectionTitles.join('\n'),
    numberOfQueries: 3 // Generate 3 queries per section
  });

  steps.push({
    agentName: 'Query Writer',
    thought: `Generating search queries for section: ${state.section.title}`,
    action: 'Generating targeted search queries',
    observation: `Generated ${result.queries.length} search queries for the section`
  });

  return {
    state: {
      searchQueries: result.queries.map(q => q.query),
      searchIterations: (state.searchIterations || 0) + 1
    },
    steps
  };
}; 