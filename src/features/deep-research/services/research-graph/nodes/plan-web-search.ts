import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState } from '../../../types/research';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { QueryResult } from '../../../types/parser-types';

// Template for generating initial research queries
const QUERY_GENERATION_TEMPLATE = `You are an expert technical writer helping to plan a learning roadmap.. Generate search queries to gather comprehensive information about: {topic}

Generate {numberOfQueries} search queries that will help understand:
1. Core concepts and fundamentals
2. Main components or aspects
3. Best practices and common approaches
4. Current trends and cutting-edge developments

Requirements:
1. Queries should be related to the topic of the learning roadmap
2. Make queries specific enough to find high-quality, relevant sources
3. Cover the breadth needed for the learning roadmap structure

Format the response as a JSON array of queries, where each query has:
- query: string
- purpose: string`;

export function planWebSearchNode(
  model: ChatOpenAI,
  searchTool: TavilySearchResults
) {
  const queryJsonParser = new JsonOutputParser<QueryResult[]>();
  const queryPrompt = PromptTemplate.fromTemplate(QUERY_GENERATION_TEMPLATE);

  return RunnableSequence.from([
    // 1. Extract initial state
    (state: ResearchState) => ({
      topic: state.topic,
      numberOfQueries: 5 // We can make this configurable if needed
    }),

    // 2. Generate initial research queries
    async (input) => {
      const queryChain = queryPrompt.pipe(model).pipe(queryJsonParser);
      const queries = await queryChain.invoke(input);

      return {
        ...input,
        queries: queries.map(q => q.query)
      };
    },

    // 3. Perform web search for each query
    async (input: { topic: string; queries: string[] }) => {
      try {
        const searchPromises = input.queries.map((query: string) => 
          searchTool.invoke(query)
        );
        
        const searchResults = await Promise.all(searchPromises);
        
        if (!searchResults.length) {
          throw new Error('No search results returned');
        }

        const allResults = searchResults.flatMap(resultStr => {
          try {
            if (Array.isArray(resultStr) && resultStr.length > 0 && typeof resultStr[0] === 'object') {
              return resultStr;
            }
            if (typeof resultStr === 'string') {
              return JSON.parse(resultStr);
            }
            return [];
          } catch (error) {
            console.warn('Failed to parse search result:', error);
            return [];
          }
        });
        
        const validResults = allResults.filter(result => 
          result && 
          typeof result === 'object' && 
          typeof result.title === 'string' && result.title.trim() &&
          typeof result.content === 'string' && result.content.trim() &&
          typeof result.url === 'string' && result.url.trim()
        );

        if (!validResults.length) {
          throw new Error('No valid search results found after parsing');
        }

        return {
          queries: input.queries,
          results: validResults.map(result => ({
            title: result.title.trim(),
            content: result.content.trim(),
            url: result.url.trim()
          }))
        };
      } catch (error) {
        console.error('Research Error Details:', error);
        throw new Error(`Failed to perform research: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  ]);
} 