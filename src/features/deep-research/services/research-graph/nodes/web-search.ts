import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState } from '../../../types/research';
import { config } from '../../../config';

interface QueryResult {
  query: string;
  purpose: string;
}

const SEARCH_QUERY_TEMPLATE = `You are an expert teacher crafting targeted web search queries that will gather comprehensive information for writing a detailed lesson for one section of a learning roadmap.:

Section Information:
Title: {sectionTitle}
Description: {sectionDescription}
Subsections: {subsectionTitles}

Generate {numberOfQueries} search queries that will help gather comprehensive information for writing this section.

Format the response as a JSON array of queries, where each query has:
- query: string
- purpose: string

Requirements:
1. Cover different aspects of the topic (e.g., core features, real-world applications, technical architecture)
2. Include specific technical terms related to the topic
3. Target recent information by including year markers where relevant (e.g., "2024")
4. Look for comparisons or differentiators from similar technologies/approaches
5. Search for both official documentation and practical implementation examples
6. Address each subsection title specifically to ensure comprehensive coverage`;

export function webSearchNode(searchTool: TavilySearchResults) {
  const queryPrompt = PromptTemplate.fromTemplate(SEARCH_QUERY_TEMPLATE);
  const jsonParser = new JsonOutputParser<QueryResult[]>();
  
  // Initialize a model for query generation
  const queryModel = new ChatOpenAI({
    modelName: "gpt-4",
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
        subsectionTitles: nextSection.subsectionTitles.join(', '),
        numberOfQueries: 3,
        section: nextSection
      };
    },
    // Generate search queries
    async (input) => {
      try {
        const queryChain = queryPrompt.pipe(queryModel).pipe(jsonParser);
        const queries = await queryChain.invoke(input);
        
        if (!queries || !queries.length) {
          throw new Error('Generated search queries are empty');
        }

        console.log('Generated search queries:', queries);

        return {
          ...input,
          queries: queries.map(q => q.query)
        };
      } catch (error) {
        throw new Error(`Failed to generate search queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    // Perform search
    async (input) => {
      try {
        if (!input.queries || !input.queries.length) {
          throw new Error('Search queries are required');
        }

        console.log('Executing Tavily searches...');
        const searchPromises = input.queries.map((query: string) => 
          searchTool.invoke(query)
        );
        
        const results = await Promise.all(searchPromises);
        
        if (!results || !results.length) {
          throw new Error('No search results returned');
        }

        // Parse and combine all search results
        const allResults = results.flatMap(resultStr => {
          try {
            if (Array.isArray(resultStr) && resultStr.length > 0 && typeof resultStr[0] === 'object') {
              return resultStr;
            }
            if (typeof resultStr === 'string') {
              return JSON.parse(resultStr);
            }
            console.warn('Unexpected result format:', resultStr);
            return [];
          } catch (error) {
            console.warn('Failed to parse search result:', error);
            return [];
          }
        });

        // Filter valid results
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

        // Format results into source string
        const sourceStr = validResults
          .map(result => `Source: ${result.title.trim()}\n${result.content.trim()}\nURL: ${result.url.trim()}`)
          .join('\n\n');

        return {
          section: input.section,
          sourceStr
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
    }
  ]);
} 