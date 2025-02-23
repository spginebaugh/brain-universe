import { v4 as uuidv4 } from 'uuid';
import { buildResearchGraph, ResearchGraph } from './research-graph/graph-builder';
import { useResearchStore } from '../stores/research-store';
import { config } from '../config';
import { ResearchLogger } from './research-logger';
import {
  ResearchState,
  ResearchConfig,
  ResearchRequest,
  FeedbackRequest,
  ResearchEvent,
  ProgressEvent,
  ErrorEvent,
  InterruptEvent,
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
      plannerModel: 'gpt-4',
      numberOfQueries: 2,
      writerModel: 'gpt-4',
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
    if (typeof event === 'object' && event !== null) {
      const eventObj = event as Record<string, unknown>;

      if ('error' in eventObj) {
        return {
          type: 'error',
          sessionId,
          error: String(eventObj.error)
        } as ErrorEvent;
      }

      if ('__interrupt__' in eventObj) {
        const interrupt = eventObj.__interrupt__;
        const value = typeof interrupt === 'object' && interrupt !== null
          ? String((interrupt as Record<string, unknown>).value || interrupt)
          : String(interrupt);
        const resumable = typeof interrupt === 'object' && interrupt !== null
          ? Boolean((interrupt as Record<string, unknown>).resumable ?? true)
          : true;

        return {
          type: 'interrupt',
          sessionId,
          value,
          resumable,
          requiresFeedback: true
        } as InterruptEvent;
      }

      // Process sections
      const sections: Section[] = [];
      
      if ('sections' in eventObj && Array.isArray(eventObj.sections)) {
        sections.push(...eventObj.sections as Section[]);
      }
      if ('section' in eventObj && typeof eventObj.section === 'object') {
        sections.push(eventObj.section as Section);
      }
      if ('completed_sections' in eventObj && Array.isArray(eventObj.completed_sections)) {
        sections.push(...eventObj.completed_sections as Section[]);
      }

      if (sections.length > 0) {
        return {
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
        } as ProgressEvent;
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
    const sessionId = uuidv4();
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

  async *provideFeedback(request: FeedbackRequest): AsyncGenerator<ResearchEvent> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    try {
      // Create a state update that includes the feedback
      const stateUpdate = {
        feedback: request.feedback,
        searchIterations: 0, // Reset search iterations
        searchQueries: [], // Reset search queries
        section: null // Reset current section
      };

      const stream = session.graph.stream(stateUpdate);
      
      for await (const event of stream) {
        const processedEvent = this.processEvent(event, request.sessionId);
        useResearchStore.getState().addEvent(request.sessionId, processedEvent);
        yield processedEvent;
      }
    } catch (error: unknown) {
      const e = error as Error;
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId: request.sessionId,
        error: e.message
      };
      useResearchStore.getState().addEvent(request.sessionId, errorEvent);
      yield errorEvent;
    }
  }
} 