import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ResearchConfig, Section } from '../../types/research';

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

export function buildResearchGraph(config: ResearchConfig): ResearchGraph {
  // Initialize models with API keys
  const plannerModel = new ChatOpenAI({
    modelName: config.plannerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
  });

  const writerModel = new ChatOpenAI({
    modelName: config.writerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
  });

  // Initialize tools with API keys
  const searchTool = new TavilySearchResults({
    apiKey: config.tavily.apiKey,
  });

  // Create node instances
  const planNode = generatePlanNode(plannerModel);
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

      // Start with planning if no sections exist
      if (!state.sections.length) {
        const planResult = await planNode.invoke(state);
        yield planResult;
        state = { ...state, ...planResult };
      }

      // Continue research and writing until all sections are completed
      while (state.completedSections.length < state.numberOfMainSections) {
        // Research phase
        const researchResult = await researchNode.invoke(state);
        yield researchResult;
        state = { ...state, ...researchResult };

        // Writing phase
        const writeResult = await writeNode.invoke(state);
        yield writeResult;
        state = { ...state, ...writeResult };
      }
    }
  };
} 