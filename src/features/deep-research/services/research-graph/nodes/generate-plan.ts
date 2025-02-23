import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState, Section } from '../../../types/research';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';

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

// Template for creating the plan using research
const PLAN_TEMPLATE = `You are an expert technical writer helping to plan a learning roadmap for the topic: {topic}

Using the following research context:
{researchContext}

Create {numberOfMainSections} main sections that would comprehensively cover this topic.
For each section:
1. Provide a clear title
2. Section descriptions should be clear and concise
3. List exactly 3 subsection titles that would help organize the content

Ensure the sections flow logically and cover the topic comprehensively using insights from the research.

Format the response as a JSON array of sections, where each section has:
- title: string
- description: string
- subsectionTitles: string[]`;

interface QueryResult {
  query: string;
  purpose: string;
}

export function generatePlanNode(
  model: ChatOpenAI,
  searchTool: TavilySearchResults
) {
  const queryJsonParser = new JsonOutputParser<QueryResult[]>();
  const sectionJsonParser = new JsonOutputParser<Section[]>();
  
  const queryPrompt = PromptTemplate.fromTemplate(QUERY_GENERATION_TEMPLATE);
  const planPrompt = PromptTemplate.fromTemplate(PLAN_TEMPLATE);

  return RunnableSequence.from([
    // 1. Extract initial state
    (state: ResearchState) => ({
      topic: state.topic,
      numberOfMainSections: state.numberOfMainSections,
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
    async (input: { topic: string; numberOfMainSections: number; queries: string[] }) => {
      try {
        const searchPromises = input.queries.map((query: string) => 
          searchTool.invoke(query)
        );
        
        const searchResults = await Promise.all(searchPromises);
        
        // Validate we have search results
        if (!searchResults.length) {
          throw new Error('No search results returned');
        }

        // Parse and combine all search results
        const allResults = searchResults.flatMap(resultStr => {
          try {
            // If the result is already an array of objects, use it directly
            if (Array.isArray(resultStr) && resultStr.length > 0 && typeof resultStr[0] === 'object') {
              return resultStr;
            }
            // If it's a string, try to parse it
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

        console.log('Parsed Results Length:', allResults.length);
        
        // Filter valid results
        const validResults = allResults.filter(result => {
          const isValid = result && 
            typeof result === 'object' && 
            typeof result.title === 'string' && result.title.trim() &&
            typeof result.content === 'string' && result.content.trim() &&
            typeof result.url === 'string' && result.url.trim();
            
          if (!isValid) {
            console.log('Invalid Result:', result);
          }
          return isValid;
        });

        console.log('Valid Results Length:', validResults.length);

        if (!validResults.length) {
          throw new Error('No valid search results found after parsing');
        }

        // Format the results
        const formattedResults = validResults.map(result => (
          `Source: ${result.title.trim()}\n${result.content.trim()}\nURL: ${result.url.trim()}`
        ));

        // Combine into final context
        const researchContext = formattedResults.join('\n\n');

        return {
          ...input,
          researchContext
        };
      } catch (error) {
        console.error('Research Error Details:', error);
        throw new Error(`Failed to perform research: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // 4. Generate plan using research context
    async (input) => {
      const planChain = planPrompt.pipe(model).pipe(sectionJsonParser);
      const sections = await planChain.invoke({
        topic: input.topic,
        numberOfMainSections: input.numberOfMainSections,
        researchContext: input.researchContext
      });

      // Validate section structure
      if (!Array.isArray(sections)) {
        throw new Error('Sections must be an array');
      }
      
      sections.forEach((section, index) => {
        if (!section.title || !section.description || !Array.isArray(section.subsectionTitles)) {
          throw new Error(`Invalid section structure at index ${index}`);
        }
        if (section.subsectionTitles.length !== 3) {
          throw new Error(`Section ${section.title} must have exactly 3 subsection titles`);
        }
      });

      // 5. Return updated state
      return {
        sections,
        completedSections: [],
        section: null
      };
    }
  ]);
} 