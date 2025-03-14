import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import {
  ResearchConfig,
  ResearchState,
  RESEARCH_PHASES,
  PhaseResult,
  InitialResearchPhaseResult,
  PlanningPhaseResult,
  ChapterResearchPhaseResult,
  ChapterWritingPhaseResult,
  CompletePhaseResult,
  Chapter,
} from "../../types/research";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

// Node implementations will be imported from separate files
import { planWebSearchNode } from "./nodes/plan-web-search";
import { generatePlanNode } from "./nodes/generate-plan";
import { sectionWebSearchNode } from "./nodes/section-web-search";
import { writeSectionNode } from "./nodes/write-section";

export interface ResearchGraph {
  stream: (initialState: ResearchState) => AsyncGenerator<PhaseResult, void, unknown>;
}

interface GraphBuilderOptions {
  callbacks?: BaseCallbackHandler[];
}

// Define extended state type for internal use
interface ExtendedResearchState extends ResearchState {
  sourceStr?: string;
  currentChapter?: Chapter;
}

/**
 * Builds the research graph
 */
export function buildResearchGraph(
  config: ResearchConfig,
  options: GraphBuilderOptions = {},
): ResearchGraph {
  const { callbacks } = options;

  // Initialize models with API keys and callbacks
  const plannerModel = new ChatOpenAI({
    modelName: config.plannerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
    callbacks,
  });

  const writerModel = new ChatOpenAI({
    modelName: config.writerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
    callbacks,
  });

  // Initialize tools with API keys and callbacks
  const searchTool = new TavilySearchResults({
    apiKey: config.tavily.apiKey,
    callbacks,
    maxResults: 5,
  });

  // Create node instances
  const initialResearchNode = planWebSearchNode(plannerModel, searchTool);
  const planNode = generatePlanNode(plannerModel);
  const chapterResearchNode = sectionWebSearchNode(searchTool);
  const chapterWritingNode = writeSectionNode(writerModel);

  return {
    async* stream(initialState: ResearchState) {
      // Use the provided initial state directly
      let state: ExtendedResearchState = initialState;

      try {
        // Initial Research phase
        if (!state.plannedChapters.length) {
          const initialResearchResult = await initialResearchNode.invoke(state, { callbacks });

          // Create the phase result
          const initialResearchPhaseResult: InitialResearchPhaseResult = {
            phase: RESEARCH_PHASES.INITIAL_RESEARCH,
            isPhaseComplete: true,
            isFinalOutput: false,
            queries: initialResearchResult.queries || [],
            results: initialResearchResult.results || [],
          };

          yield initialResearchPhaseResult;

          // Update state with initial research results
          state = {
            ...state,
            initialResearch: {
              queries: initialResearchPhaseResult.queries,
              results: initialResearchPhaseResult.results,
            },
            currentPhase: RESEARCH_PHASES.INITIAL_RESEARCH,
          };

          // Planning phase
          const planResult = await planNode.invoke(state, { callbacks });

          // Parse planned chapters if needed
          const plannedChapters = planResult.plannedChapters || [];

          // Create the phase result
          const planningPhaseResult: PlanningPhaseResult = {
            phase: RESEARCH_PHASES.PLANNING,
            isPhaseComplete: true,
            isFinalOutput: false,
            plannedChapters,
          };

          yield planningPhaseResult;

          // Update state with planning results
          state = {
            ...state,
            plannedChapters,
            chapterOrder: plannedChapters.map((chapter: Chapter) => chapter.title),
            chapters: plannedChapters.reduce<Record<string, Chapter>>((acc, chapter) => {
              // Create a proper Chapter object with all required properties
              acc[chapter.title] = {
                title: chapter.title,
                description: chapter.description,
                subTopicNames: chapter.subTopicNames,
                status: "pending",
                phase: RESEARCH_PHASES.PLANNING,
                timestamp: new Date().toISOString(),
              };
              return acc;
            }, {}),
            currentPhase: RESEARCH_PHASES.PLANNING,
            progress: {
              ...state.progress,
              totalChapters: plannedChapters.length,
            },
          };
        }

        // Chapter research and writing loop
        while (state.progress.completedChapters < state.progress.totalChapters) {
          // Find the next chapter to process
          const nextChapterTitle = state.currentChapterTitle ||
            state.chapterOrder.find((title: string) => state.chapters[title].status === "pending");

          if (!nextChapterTitle) {
            console.warn("No pending chapters found, but not all chapters are completed");
            break;
          }

          // Update current chapter
          state = {
            ...state,
            currentChapterTitle: nextChapterTitle,
          };

          // Chapter Research phase
          const chapterResearchResult = await chapterResearchNode.invoke(state, { callbacks });

          // Parse the search results from JSON string
          const searchOutput = JSON.parse(chapterResearchResult.content);

          // Extract research data
          const queries = searchOutput.queries || [];
          const results = searchOutput.results || [];

          // Create the phase result
          const chapterResearchPhaseResult: ChapterResearchPhaseResult = {
            phase: RESEARCH_PHASES.CHAPTER_RESEARCH,
            isPhaseComplete: true,
            isFinalOutput: false,
            chapterTitle: nextChapterTitle,
            queries,
            results,
          };

          yield chapterResearchPhaseResult;

          // Update state with research results and prepare for writing phase
          state = {
            ...state,
            chapters: {
              ...state.chapters,
              [nextChapterTitle]: {
                ...state.chapters[nextChapterTitle],
                phase: RESEARCH_PHASES.CHAPTER_RESEARCH,
                timestamp: new Date().toISOString(),
                status: "researching",
                research: {
                  queries,
                  results,
                },
              },
            },
            currentPhase: RESEARCH_PHASES.CHAPTER_RESEARCH,
            // Add the source string for the writing phase
            sourceStr: chapterResearchResult.sourceStr,
            // Add the current chapter for the writing phase
            currentChapter: chapterResearchResult.currentChapter,
          };

          // Chapter Writing phase
          if (!state.currentChapter) {
            throw new Error("Missing current chapter for writing phase");
          }

          if (!state.sourceStr) {
            throw new Error("Missing source data for writing phase");
          }

          const chapterWritingResult = await chapterWritingNode.invoke(state, { callbacks });

          // Extract content from the updated state
          const updatedChapter = chapterWritingResult.chapters[nextChapterTitle];
          const content = updatedChapter?.content;

          if (!content) {
            console.error(`No content generated for chapter "${nextChapterTitle}"`);
            continue;
          }

          // Create the phase result
          const chapterWritingPhaseResult: ChapterWritingPhaseResult = {
            phase: RESEARCH_PHASES.CHAPTER_WRITING,
            isPhaseComplete: true,
            isFinalOutput: false,
            chapterTitle: nextChapterTitle,
            content,
          };

          yield chapterWritingPhaseResult;

          // The state is already updated by the writing node, just need to update the phase
          state = {
            ...chapterWritingResult,
            currentPhase: RESEARCH_PHASES.CHAPTER_WRITING,
          };

          // Clear current chapter if all are completed
          if (state.progress.completedChapters >= state.progress.totalChapters) {
            state = {
              ...state,
              currentChapterTitle: null,
            };
          }
        }

        // Complete phase
        const completePhaseResult: CompletePhaseResult = {
          phase: RESEARCH_PHASES.COMPLETE,
          isPhaseComplete: true,
          isFinalOutput: true,
        };

        yield completePhaseResult;
      } catch (error) {
        console.error("Error in research graph:", error);
        throw error;
      }
    },
  };
}
