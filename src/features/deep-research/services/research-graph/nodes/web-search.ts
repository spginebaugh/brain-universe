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
Subsections: {subsectionTitles}

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