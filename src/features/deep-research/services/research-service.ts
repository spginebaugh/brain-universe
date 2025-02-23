import { v4 as uuidv4 } from 'uuid';
import { buildResearchGraph, ResearchGraph } from './research-graph/graph-builder';
import { useResearchStore } from '../stores/research-store';
import { config } from '../config';
import { ResearchLogger } from './research-logger';
import {
  ResearchState,
  ResearchConfig,
  ResearchRequest,
  ResearchEvent,
  ProgressEvent,
  ErrorEvent,
  Section
} from '../types/research';

export class ResearchService {
  private sessions: Map<string, {
    graph: ResearchGraph;
    config: ResearchConfig;
  }>;

  constructor() {
    this.sessions = new Map();
  }

  private createSession(sessionId: string): {
    graph: ResearchGraph;
    config: ResearchConfig;
  } {
    const sessionConfig: ResearchConfig = {
      threadId: sessionId,
      searchApi: 'tavily',
      plannerProvider: 'openai',
      maxSearchDepth: 1,
      plannerModel: 'gpt-4o',
      numberOfQueries: 2,
      writerModel: 'gpt-4o',
      openai: config.openai,
      tavily: config.tavily,
      langsmith: config.langsmith
    };

    // Create a logger instance for this session
    const logger = new ResearchLogger(sessionId);

    // Build graph with logger
    const graph = buildResearchGraph(sessionConfig, {
      callbacks: [logger]
    });

    const session = { graph, config: sessionConfig };
    this.sessions.set(sessionId, session);
    
    return session;
  }

  private processEvent(event: unknown, sessionId: string): ResearchEvent {
    console.log('Processing event:', event);
    
    if (typeof event === 'object' && event !== null) {
      const eventObj = event as Record<string, unknown>;

      if ('error' in eventObj) {
        return {
          type: 'error',
          sessionId,
          error: String(eventObj.error)
        } as ErrorEvent;
      }

      // Process sections - check for completedSections first
      let sections: Section[] = [];
      
      if ('completedSections' in eventObj && Array.isArray(eventObj.completedSections)) {
        sections = eventObj.completedSections as Section[];
      } else {
        // Fallback to other section fields if completedSections is not present
        if ('sections' in eventObj && Array.isArray(eventObj.sections)) {
          sections.push(...eventObj.sections as Section[]);
        }
        if ('section' in eventObj && typeof eventObj.section === 'object' && eventObj.section !== null) {
          sections.push(eventObj.section as Section);
        }
      }

      console.log('Processed sections:', sections);

      if (sections.length > 0) {
        const progressEvent: ProgressEvent = {
          type: 'progress',
          sessionId,
          content: null,
          sections,
          steps: [{
            agentName: sections.length > 1 ? 'Report Planner' : 'Section Writer',
            thought: `Processing ${sections.length} section(s)`,
            action: sections.length > 1 ? 'Planning sections' : 'Writing content',
            observation: `Generated content for ${sections.length} section(s)`
          }]
        };
        console.log('Created progress event:', progressEvent);
        return progressEvent;
      }
    }

    // Default progress event
    return {
      type: 'progress',
      sessionId,
      content: String(event),
      sections: [],
      steps: []
    } as ProgressEvent;
  }

  async *startResearch(request: ResearchRequest): AsyncGenerator<ResearchEvent> {
    const sessionId = request.sessionId || uuidv4();
    const session = this.createSession(sessionId);

    const initialState: ResearchState = {
      topic: request.query,
      numberOfMainSections: request.numberOfMainSections || 6,
      sections: [],
      section: null,
      searchIterations: 0,
      searchQueries: [],
      sourceStr: '',
      completedSections: [],
      reportSectionsFromResearch: ''
    };

    try {
      const stream = session.graph.stream(initialState);
      for await (const event of stream) {
        const processedEvent = this.processEvent(event, sessionId);
        useResearchStore.getState().addEvent(sessionId, processedEvent);
        yield processedEvent;
      }
    } catch (error: unknown) {
      const e = error as Error;
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId,
        error: e.message
      };
      useResearchStore.getState().addEvent(sessionId, errorEvent);
      yield errorEvent;
    }
  }
} 