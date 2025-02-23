import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ResearchConfig, Section } from '../../types/research';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { JsonOutputParser } from '@langchain/core/output_parsers';

// Node implementations will be imported from separate files
import { generatePlanNode } from './nodes/generate-plan';
import { webSearchNode } from './nodes/web-search';
import { writeSectionNode } from './nodes/write-section';

// Define state interface
export interface ResearchState {
  topic: string;
  numberOfMainSections: number;
  sections: Section[];
  section: Section | null;
  searchIterations: number;
  searchQueries: string[];
  sourceStr: string;
  completedSections: Section[];
  reportSectionsFromResearch: string;
}

export interface ResearchGraph {
  stream: (initialState: Partial<ResearchState>) => AsyncGenerator<Partial<ResearchState>, void, unknown>;
}

interface GraphBuilderOptions {
  callbacks?: BaseCallbackHandler[];
}

interface ResearchResult extends Partial<ResearchState> {
  content?: unknown;
  additionalData?: Record<string, unknown>;
}

export function buildResearchGraph(
  config: ResearchConfig, 
  options: GraphBuilderOptions = {}
): ResearchGraph {
  const { callbacks } = options;
  const jsonParser = new JsonOutputParser();

  // Initialize models with API keys and callbacks
  const plannerModel = new ChatOpenAI({
    modelName: config.plannerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
    callbacks
  });

  const writerModel = new ChatOpenAI({
    modelName: config.writerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
    callbacks
  });

  // Initialize tools with API keys and callbacks
  const searchTool = new TavilySearchResults({
    apiKey: config.tavily.apiKey,
    callbacks,
    maxResults: 5
  });

  // Create node instances
  const planNode = generatePlanNode(plannerModel, searchTool);
  const researchNode = webSearchNode(searchTool);
  const writeNode = writeSectionNode(writerModel);

  return {
    async *stream(initialState: Partial<ResearchState>) {
      // Initialize state with defaults
      let state: ResearchState = {
        topic: initialState.topic || '',
        numberOfMainSections: initialState.numberOfMainSections || 0,
        sections: initialState.sections || [],
        section: initialState.section || null,
        searchIterations: initialState.searchIterations || 0,
        searchQueries: initialState.searchQueries || [],
        sourceStr: initialState.sourceStr || '',
        completedSections: initialState.completedSections || [],
        reportSectionsFromResearch: initialState.reportSectionsFromResearch || ''
      };

      try {
        // Start with planning if no sections exist
        if (!state.sections.length) {
          const planResult = await planNode.invoke(state, { callbacks }) as ResearchResult;
          if (planResult.content && typeof planResult.content === 'string') {
            planResult.content = await jsonParser.invoke(planResult.content);
          }
          yield planResult;
          state = { ...state, ...planResult };
        }

        // Continue research and writing until all sections are completed
        while (state.completedSections.length < state.numberOfMainSections) {
          // Research phase
          const researchResult = await researchNode.invoke(state, { callbacks }) as ResearchResult;
          if (researchResult.content && typeof researchResult.content === 'string') {
            researchResult.content = await jsonParser.invoke(researchResult.content);
          }
          yield researchResult;
          state = { ...state, ...researchResult };

          // Writing phase
          const writeResult = await writeNode.invoke(state, { callbacks }) as ResearchResult;
          if (writeResult.content && typeof writeResult.content === 'string') {
            writeResult.content = await jsonParser.invoke(writeResult.content);
          }
          yield writeResult;
          state = { ...state, ...writeResult };
        }
      } catch (error) {
        console.error('Error in research graph:', error);
        throw error;
      }
    }
  };
} 