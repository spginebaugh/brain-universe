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
  Section,
  RESEARCH_STEPS,
  ResearchStep,
  ResearchStepInfo,
  StepResult,
  SectionContent
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

  private getActionForStep(step: ResearchStep): string {
    if (step === RESEARCH_STEPS.COMPLETE) {
      return 'Finalizing research';
    }
    switch (step) {
      case RESEARCH_STEPS.PLANNING:
        return 'Planning sections';
      case RESEARCH_STEPS.RESEARCH:
        return 'Gathering information';
      case RESEARCH_STEPS.WRITING:
        return 'Writing content';
      default:
        return 'Processing';
    }
  }

  private getThoughtForStep(step: ResearchStep, sections: Section[]): string {
    if (step === RESEARCH_STEPS.COMPLETE) {
      return 'Research process completed';
    }
    return `Processing ${sections.length} section(s)`;
  }

  private getObservationForStep(step: ResearchStep, sections: Section[]): string {
    if (step === RESEARCH_STEPS.COMPLETE) {
      return `Research completed with ${sections.length} total sections`;
    }
    return `Generated content for ${sections.length} section(s)`;
  }

  private processEvent(event: unknown, sessionId: string): ResearchEvent {
    console.log('Processing event:', event);
    
    if (typeof event === 'object' && event !== null) {
      const stepResult = event as StepResult;
      
      // Handle step information
      const step = stepResult.step || RESEARCH_STEPS.RESEARCH;
      const isProcessComplete = stepResult.isComplete || false;
      const isFinalOutput = stepResult.isFinalOutput || false;

      if ('error' in stepResult) {
        return {
          type: 'error',
          sessionId,
          step,
          isProcessComplete,
          isFinalOutput,
          error: String(stepResult.error)
        } as ErrorEvent;
      }

      // Process sections based on step type
      let sections: Section[] = [];
      let content = stepResult.content;

      try {
        // Parse content if it's a string
        if (typeof content === 'string') {
          content = JSON.parse(content);
        }
      } catch (e) {
        console.warn('Failed to parse content:', e);
        content = { rawContent: content };
      }

      if (step === RESEARCH_STEPS.QUERY_RESEARCH) {
        sections = [];  // No sections for query research
      }
      else if (step === RESEARCH_STEPS.PLANNING) {
        if ('sections' in stepResult) {
          sections = (stepResult.sections as Section[]).map(section => ({
            ...section,
            step: RESEARCH_STEPS.PLANNING,
            status: 'in_progress' as const
          }));
        }
      } 
      else if (step === RESEARCH_STEPS.RESEARCH) {
        if ('section' in stepResult) {
          sections = [{
            ...(stepResult.section as Section),
            step: RESEARCH_STEPS.RESEARCH,
            status: 'in_progress' as const,
            content: content as string | SectionContent // Type assertion for content
          }];
        }
      } 
      else if (step === RESEARCH_STEPS.WRITING) {
        if ('section' in stepResult) {
          sections = [{
            ...(stepResult.section as Section),
            step: RESEARCH_STEPS.WRITING,
            status: 'done' as const,
            content: content as string | SectionContent // Type assertion for content
          }];
        }
      } 
      else if (step === RESEARCH_STEPS.COMPLETE) {
        if ('completedSections' in stepResult) {
          sections = (stepResult.completedSections as Section[]).map(section => ({
            ...section,
            step: RESEARCH_STEPS.COMPLETE,
            status: 'done' as const
          }));
        }
      }

      const steps: ResearchStepInfo[] = [{
        action: this.getActionForStep(step),
        thought: this.getThoughtForStep(step, sections),
        observation: this.getObservationForStep(step, sections)
      }];

      return {
        type: 'progress',
        sessionId,
        step,
        isProcessComplete,
        isFinalOutput,
        content, // Pass through the parsed content
        sections,
        steps
      } as ProgressEvent;
    }

    // Default progress event for unknown event types
    return {
      type: 'progress',
      sessionId,
      step: RESEARCH_STEPS.RESEARCH,
      isProcessComplete: false,
      isFinalOutput: false,
      content: String(event),
      sections: [],
      steps: [{
        action: this.getActionForStep(RESEARCH_STEPS.RESEARCH),
        thought: 'Processing unknown event',
        observation: 'Received unknown event type'
      }]
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
        step: RESEARCH_STEPS.COMPLETE,
        isProcessComplete: true,
        isFinalOutput: true,
        error: e.message
      };
      useResearchStore.getState().addEvent(sessionId, errorEvent);
      yield errorEvent;
    }
  }
} 