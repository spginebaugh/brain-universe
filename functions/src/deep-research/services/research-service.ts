import { v4 as uuidv4 } from "uuid";
import * as logger from "firebase-functions/logger";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

import { DeepResearchConfig } from "../config";
import { ResearchFirestoreService } from "./research-firestore-service";
import {
  ResearchState,
  ResearchPhase,
  RESEARCH_PHASES,
  PhaseResult,
  Chapter,
} from "../types/research";

// Will be implemented later - graph builder for research
import { buildResearchGraph } from "./research-graph/graph-builder";

/**
 * Firebase logger
 */
class FirebaseLogger extends BaseCallbackHandler {
  private sessionId: string;
  private userId: string;
  name = "FirebaseLogger";

  /**
   * Constructor
   */
  constructor(userId: string, sessionId: string) {
    super();
    this.userId = userId;
    this.sessionId = sessionId;
  }

  /**
   * Handle LLM start
   */
  handleLLMStart() {
    logger.debug("LLM started", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  /**
   * Handle LLM end
   */
  handleLLMEnd() {
    logger.debug("LLM completed", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  /**
   * Handle chain start
   */
  handleChainStart() {
    logger.debug("Chain started", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  /**
   * Handle chain end
   */
  handleChainEnd() {
    logger.debug("Chain completed", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  /**
   * Handle tool start
   */
  handleToolStart() {
    logger.debug("Tool started", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }

  /**
   * Handle tool end
   */
  handleToolEnd() {
    logger.debug("Tool completed", {
      userId: this.userId,
      sessionId: this.sessionId,
    });
  }
}

/**
 * Runs the research process using the provided configuration
 * This function handles the entire research workflow and updates Firestore with progress
 */
export async function runResearchProcess(
  userId: string,
  sessionId: string,
  config: DeepResearchConfig,
  firestoreService: ResearchFirestoreService,
): Promise<void> {
  // Get the current session from Firestore
  const session = await firestoreService.getSession(userId, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Create the initial state from the session
  let state: ResearchState = session.state;

  // Set up heartbeat interval (every 5 minutes)
  const heartbeatInterval = setInterval(async () => {
    try {
      await firestoreService.updateHeartbeat(userId, sessionId);
      logger.debug("Heartbeat updated", { userId, sessionId });
    } catch (error) {
      logger.error("Failed to update heartbeat", {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, 5 * 60 * 1000); // 5 minutes

  try {
    // Initialize logger
    const firebaseLogger = new FirebaseLogger(userId, sessionId);

    // Initialize models with API keys and callbacks
    const plannerModel = new ChatOpenAI({
      modelName: config.models.plannerModel,
      temperature: 0.7,
      openAIApiKey: config.openai.apiKey,
      callbacks: [firebaseLogger],
    });

    const writerModel = new ChatOpenAI({
      modelName: config.models.writerModel,
      temperature: 0.7,
      openAIApiKey: config.openai.apiKey,
      callbacks: [firebaseLogger],
    });

    // Initialize tools with API keys and callbacks
    const searchTool = new TavilySearchResults({
      apiKey: config.tavily.apiKey,
      callbacks: [firebaseLogger],
      maxResults: 5,
    });

    // Research config derived from the DeepResearchConfig
    const researchConfig = {
      threadId: uuidv4(),
      searchApi: "tavily" as const,
      plannerProvider: "openai" as const,
      maxSearchDepth: config.search.maxDepth,
      plannerModel: config.models.plannerModel,
      numberOfQueries: config.search.numberOfQueries,
      writerModel: config.models.writerModel,
      openai: config.openai,
      tavily: config.tavily,
      langsmith: config.langsmith,
    };

    // Build research graph
    const graph = buildResearchGraph(researchConfig, {
      callbacks: [firebaseLogger],
    });

    // Run the research graph
    const stream = graph.stream(state);

    // Process each event from the stream
    for await (const phaseResult of stream) {
      // Log the phase completion
      logger.info(`Research phase completed: ${phaseResult.phase}`, {
        userId,
        sessionId,
        phase: phaseResult.phase,
        timestamp: new Date().toISOString(),
      });

      // Update state based on the phase result
      state = updateStateFromPhaseResult(state, phaseResult);

      // Update session in Firestore with more detailed progress
      await firestoreService.updateSessionWithPhaseResult(
        userId,
        sessionId,
        phaseResult,
        state,
      );

      // Log detailed progress
      logger.info("Research progress updated", {
        userId,
        sessionId,
        phase: phaseResult.phase,
        progress: {
          completedPhases: Object.keys(state).filter((key) =>
            RESEARCH_PHASES[key as keyof typeof RESEARCH_PHASES] !== undefined,
          ).length,
          totalPhases: Object.keys(RESEARCH_PHASES).length,
          currentPhase: state.currentPhase,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Research is complete
    await firestoreService.completeSession(
      userId,
      sessionId,
      state,
    );

    logger.info("Research process completed successfully", {
      userId,
      sessionId,
      completionTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Research process failed", {
      userId,
      sessionId,
      error: error instanceof Error ? error.message : "Unknown error",
      failureTime: new Date().toISOString(),
    });

    // Update session with error
    await firestoreService.failSession(
      userId,
      sessionId,
      error instanceof Error ? error.message : "Unknown error",
    );

    // Re-throw the error
    throw error;
  } finally {
    // Clear heartbeat interval
    clearInterval(heartbeatInterval);
  }
}

/**
 * Updates the research state based on the phase result
 */
function updateStateFromPhaseResult(
  state: ResearchState,
  phaseResult: PhaseResult,
): ResearchState {
  // Create a copy of the state to modify
  const newState = { ...state };

  switch (phaseResult.phase) {
  case RESEARCH_PHASES.INITIAL_RESEARCH: {
    newState.initialResearch = {
      queries: phaseResult.queries,
      results: phaseResult.results,
    };
    newState.currentPhase = RESEARCH_PHASES.INITIAL_RESEARCH;
    break;
  }
  case RESEARCH_PHASES.PLANNING: {
    // Parse planned chapters
    const plannedChapters = phaseResult.plannedChapters;

    // Update state with planning results
    newState.plannedChapters = plannedChapters;
    newState.chapterOrder = plannedChapters.map((chapter) => chapter.title);
    newState.chapters = plannedChapters.reduce<Record<string, Chapter>>((acc, chapter) => {
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
    }, {});
    newState.currentPhase = RESEARCH_PHASES.PLANNING;
    newState.progress = {
      ...newState.progress,
      totalChapters: plannedChapters.length,
    };
    break;
  }
  case RESEARCH_PHASES.CHAPTER_RESEARCH: {
    // Update the chapter with research results
    const chapterTitle = phaseResult.chapterTitle;
    const chapter = newState.chapters[chapterTitle];

    if (chapter) {
      newState.chapters[chapterTitle] = {
        ...chapter,
        phase: RESEARCH_PHASES.CHAPTER_RESEARCH,
        timestamp: new Date().toISOString(),
        status: "researching",
        research: {
          queries: phaseResult.queries,
          results: phaseResult.results,
        },
      };
    }

    newState.currentPhase = RESEARCH_PHASES.CHAPTER_RESEARCH;
    newState.currentChapterTitle = chapterTitle;
    break;
  }
  case RESEARCH_PHASES.CHAPTER_WRITING: {
    // Update the chapter with written content
    const chapterTitle = phaseResult.chapterTitle;
    const chapter = newState.chapters[chapterTitle];

    if (chapter) {
      newState.chapters[chapterTitle] = {
        ...chapter,
        phase: RESEARCH_PHASES.CHAPTER_WRITING,
        timestamp: new Date().toISOString(),
        status: "completed",
        content: phaseResult.content,
      };
    }

    // Update progress
    newState.progress = {
      ...newState.progress,
      completedChapters: newState.progress.completedChapters + 1,
    };

    newState.currentPhase = RESEARCH_PHASES.CHAPTER_WRITING;

    // Clear current chapter if all are completed
    if (newState.progress.completedChapters >= newState.progress.totalChapters) {
      newState.currentChapterTitle = null;
    } else {
      // Find the next chapter to process
      const nextChapterTitle = newState.chapterOrder.find(
        (title) => newState.chapters[title].status === "pending",
      );
      newState.currentChapterTitle = nextChapterTitle || null;
    }
    break;
  }
  case RESEARCH_PHASES.COMPLETE: {
    newState.currentPhase = RESEARCH_PHASES.COMPLETE;
    break;
  }
  }

  return newState;
}
