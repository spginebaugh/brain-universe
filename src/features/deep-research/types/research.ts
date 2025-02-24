import { z } from 'zod';

// Base types
export interface ResearchRequest {
  query: string;
  numberOfMainSections?: number;
  sessionId?: string;
}

export interface FeedbackRequest {
  sessionId: string;
  feedback: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

export interface SubSection {
  title: string;
  description: string;
  content: string;
  sources: ResearchSource[];
}

export interface SectionContent {
  overview: string;
  subsections: Record<string, SubSection>;
}

export interface Section {
  title: string;
  description: string;
  subsectionTitles: string[];
  content?: string | SectionContent;
  step?: ResearchStep;
  timestamp?: string;
  status: 'pending' | 'in_progress' | 'done';
}

// Step types
export const RESEARCH_STEPS = {
  QUERY_RESEARCH: 'QUERY_RESEARCH',
  PLANNING: 'PLANNING',
  RESEARCH: 'RESEARCH',
  WRITING: 'WRITING',
  COMPLETE: 'COMPLETE'
} as const;

export type ResearchStep = typeof RESEARCH_STEPS[keyof typeof RESEARCH_STEPS];

// Event types
export interface BaseEvent {
  type: string;
  sessionId: string;
  step: ResearchStep;
  isProcessComplete?: boolean;
  isFinalOutput?: boolean;
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  content: string | null;
  sections: Section[];
  steps: ResearchStepInfo[];
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: string;
}

export interface InterruptEvent extends BaseEvent {
  type: 'interrupt';
  value: string;
  resumable: boolean;
  requiresFeedback: boolean;
}

// Rename old ResearchStep to ResearchStepInfo to avoid naming conflict
export interface ResearchStepInfo {
  action: string;
  thought: string;
  observation: string;
}

export interface StepResult extends Partial<ResearchState> {
  step: ResearchStep;
  isComplete: boolean;
  isFinalOutput?: boolean;
  content?: unknown;
  additionalData?: Record<string, unknown>;
}

// Zod schemas for validation
export const researchRequestSchema = z.object({
  query: z.string().min(1),
  numberOfMainSections: z.number().optional().default(6)
});

export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().min(1)
});

export type ResearchEvent = ProgressEvent | ErrorEvent | InterruptEvent;

// State types
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
  researchResults?: Array<{
    title: string;
    content: string;
    url: string;
  }>;
}

export interface ResearchConfig {
  threadId: string;
  searchApi: 'tavily';
  plannerProvider: 'openai';
  maxSearchDepth: number;
  plannerModel: string;
  numberOfQueries: number;
  writerModel: string;
  openai: {
    apiKey: string;
  };
  tavily: {
    apiKey: string;
  };
  langsmith: {
    apiKey: string;
    apiUrl: string;
    project: string;
    tracing: boolean;
  };
} 