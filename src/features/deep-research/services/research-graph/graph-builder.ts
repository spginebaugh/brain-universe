import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ResearchConfig, ResearchState, RESEARCH_STEPS, StepResult } from '../../types/research';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { JsonOutputParser } from '@langchain/core/output_parsers';

// Node implementations will be imported from separate files
import { planWebSearchNode } from './nodes/plan-web-search';
import { generatePlanNode } from './nodes/generate-plan';
import { sectionWebSearchNode } from './nodes/section-web-search';
import { writeSectionNode } from './nodes/write-section';

export interface ResearchGraph {
  stream: (initialState: Partial<ResearchState>) => AsyncGenerator<StepResult, void, unknown>;
}

interface GraphBuilderOptions {
  callbacks?: BaseCallbackHandler[];
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
  const planSearchNode = planWebSearchNode(plannerModel, searchTool);
  const planNode = generatePlanNode(plannerModel);
  const researchNode = sectionWebSearchNode(searchTool);
  const writeNode = writeSectionNode(writerModel);

  return {
    async *stream(initialState: Partial<ResearchState>) {
      let state: ResearchState = {
        topic: initialState.topic || '',
        numberOfMainSections: initialState.numberOfMainSections || 0,
        sections: initialState.sections || [],
        section: initialState.section || null,
        searchIterations: initialState.searchIterations || 0,
        searchQueries: initialState.searchQueries || [],
        sourceStr: initialState.sourceStr || '',
        completedSections: initialState.completedSections || [],
        reportSectionsFromResearch: initialState.reportSectionsFromResearch || '',
        researchResults: initialState.researchResults || []
      };

      try {
        // Initial Query Research phase
        if (!state.sections.length) {
          const planSearchResult = await planSearchNode.invoke(state, { callbacks }) as Partial<StepResult> & {
            results?: Array<{ title: string; content: string; url: string; }>;
          };
          const queryResearchResult: StepResult = {
            step: RESEARCH_STEPS.QUERY_RESEARCH,
            isComplete: true,
            isFinalOutput: false,
            content: planSearchResult.content
          };
          yield queryResearchResult;
          
          // Ensure researchResults is defined before planning phase
          const researchResults = planSearchResult.results || [];
          state = { ...state, researchResults };

          // Planning phase
          const planResult = await planNode.invoke(state, { callbacks }) as Partial<StepResult>;
          const enhancedPlanResult: StepResult = {
            ...planResult,
            step: RESEARCH_STEPS.PLANNING,
            isComplete: true,
            isFinalOutput: false
          };
          if (enhancedPlanResult.content && typeof enhancedPlanResult.content === 'string') {
            enhancedPlanResult.content = await jsonParser.invoke(enhancedPlanResult.content);
          }
          yield enhancedPlanResult;
          state = { ...state, ...planResult };
        }

        // Research and writing loop
        while (state.completedSections.length < state.numberOfMainSections) {
          // Research phase
          const researchResult = await researchNode.invoke(state, { callbacks }) as Partial<StepResult>;
          const enhancedResearchResult: StepResult = {
            ...researchResult,
            step: RESEARCH_STEPS.RESEARCH,
            isComplete: true,
            isFinalOutput: false
          };
          if (enhancedResearchResult.content && typeof enhancedResearchResult.content === 'string') {
            enhancedResearchResult.content = await jsonParser.invoke(enhancedResearchResult.content);
          }
          yield enhancedResearchResult;
          state = { ...state, ...researchResult };

          // Writing phase
          const writeResult = await writeNode.invoke(state, { callbacks }) as Partial<StepResult>;
          const enhancedWriteResult: StepResult = {
            ...writeResult,
            step: RESEARCH_STEPS.WRITING,
            isComplete: true,
            isFinalOutput: false
          };
          if (enhancedWriteResult.content && typeof enhancedWriteResult.content === 'string') {
            enhancedWriteResult.content = await jsonParser.invoke(enhancedWriteResult.content);
          }
          yield enhancedWriteResult;
          state = { ...state, ...writeResult };
        }

        // Yield final completion event
        const finalResult: StepResult = {
          step: RESEARCH_STEPS.COMPLETE,
          isComplete: true,
          isFinalOutput: true,
          content: state.completedSections
        };
        yield finalResult;

      } catch (error) {
        console.error('Error in research graph:', error);
        throw error;
      }
    }
  };
} 