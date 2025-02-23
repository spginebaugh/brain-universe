import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ResearchState } from '../../../types/research';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../../../config';

const SEARCH_QUERY_TEMPLATE = `Given the section to research:
Title: {sectionTitle}
Description: {sectionDescription}

Generate a search query that will help find relevant information for this section.
The query should be specific and focused on gathering accurate information.
Keep the query concise but include key terms that will yield relevant results.`;

export function webSearchNode(searchTool: TavilySearchResults) {
  const queryPrompt = PromptTemplate.fromTemplate(SEARCH_QUERY_TEMPLATE);
  const stringParser = new StringOutputParser();
  
  // Initialize a model for query generation
  const queryModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
    apiKey: config.openai.apiKey
  });

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
      try {
        const queryChain = queryPrompt.pipe(queryModel).pipe(stringParser);
        const query = await queryChain.invoke(input);
        
        if (!query) {
          throw new Error('Generated search query is empty');
        }

        console.log('Generated search query:', query);

        return {
          ...input,
          query
        };
      } catch (error) {
        throw new Error(`Failed to generate search query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    // Perform search
    async (input) => {
      try {
        if (!input.query) {
          throw new Error('Search query is required');
        }

        console.log('Executing Tavily search with query:', input.query);
        const results = await searchTool.invoke(input.query);
        
        if (!results || !Array.isArray(results)) {
          console.error('Invalid search results format:', results);
          throw new Error('Invalid search results format returned');
        }

        if (results.length === 0) {
          console.warn('No search results found for query:', input.query);
        } else {
          console.log(`Found ${results.length} search results`);
        }

        return {
          section: input.section,
          searchResults: results
        };
      } catch (error) {
        console.error('Search error:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('400')) {
            throw new Error('Invalid search request. Please check your API key and query format.');
          } else if (error.message.includes('401')) {
            throw new Error('Invalid or expired Tavily API key.');
          } else if (error.message.includes('429')) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
        }
        
        throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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