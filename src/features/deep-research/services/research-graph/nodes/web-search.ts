import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { ResearchState } from '../../../types/research';

const SEARCH_QUERY_TEMPLATE = `Given the section to research:
Title: {sectionTitle}
Description: {sectionDescription}

Generate a search query that will help find relevant information for this section.
The query should be specific and focused on gathering accurate information.
Keep the query concise but include key terms that will yield relevant results.`;

export function webSearchNode(searchTool: TavilySearchResults) {
  const queryPrompt = PromptTemplate.fromTemplate(SEARCH_QUERY_TEMPLATE);

  return RunnableSequence.from([
    // Extract section to research
    (state: ResearchState) => {
      const nextSection = state.sections.find(s => 
        !state.completedSections.some(cs => cs.title === s.title)
      );
      
      if (!nextSection) {
        throw new Error('No sections left to research');
      }
      
      return {
        sectionTitle: nextSection.title,
        sectionDescription: nextSection.description,
        section: nextSection
      };
    },
    // Generate search query
    async (input) => {
      const query = await queryPrompt.invoke(input);
      return {
        ...input,
        query: String(query)
      };
    },
    // Perform search
    async (input) => {
      const results = await searchTool.invoke(input.query);
      return {
        section: input.section,
        searchResults: results
      };
    },
    // Update state
    async (result): Promise<Partial<ResearchState>> => {
      return {
        section: result.section,
        sourceStr: JSON.stringify(result.searchResults),
        searchIterations: 1
      };
    }
  ]);
} 