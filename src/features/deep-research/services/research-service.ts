import { v4 as uuidv4 } from 'uuid';
import { buildResearchGraph } from './research-graph/graph-builder';
import { useResearchStore } from '../stores/research-store';
import { ResearchLogger } from './research-logger';
import {
  ResearchState,
  ResearchRequest,
  ResearchEvent,
  ErrorEvent,
  RESEARCH_PHASES,
  PhaseResult
} from '../types/research';

export class ResearchService {
  constructor() {}

  /**
   * Starts a research process and returns an async generator of research events
   */
  async *startResearch(request: ResearchRequest): AsyncGenerator<ResearchEvent> {
    // Get a fresh reference to the store each time
    const store = useResearchStore.getState();
    const sessionId = request.sessionId || uuidv4();
    
    try {
      // Create a session in the store
      store.createSession({
        ...request,
        sessionId
      });
      
      // Get the session after creation to ensure it exists
      const session = store.getSession(sessionId);
      if (!session) {
        throw new Error(`Failed to create session: ${sessionId}`);
      }
      
      // Create a logger instance for this session
      const logger = new ResearchLogger(sessionId);
      
      // Build graph with logger
      const graph = buildResearchGraph(session.config, {
        callbacks: [logger]
      });
      
      // Start the research stream
      const initialState: ResearchState = session.state;
      const stream = graph.stream(initialState);
      
      for await (const event of stream) {
        // Process the event through the store
        // Get a fresh reference to the store for each event
        const currentStore = useResearchStore.getState();
        const processedEvent = currentStore.processPhaseResult(sessionId, event as PhaseResult);
        yield processedEvent;
      }
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Research error:", e);
      
      // Get a fresh reference to the store for error handling
      const currentStore = useResearchStore.getState();
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId,
        phase: RESEARCH_PHASES.COMPLETE,
        isProcessComplete: true,
        isFinalOutput: true,
        error: e.message
      };
      currentStore.addEvent(sessionId, errorEvent);
      yield errorEvent;
    }
  }
} 