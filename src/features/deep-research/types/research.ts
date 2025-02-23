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
}

// Event types
export interface BaseEvent {
  type: string;
  sessionId: string;
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  content: string | null;
  sections: Section[];
  steps: ResearchStep[];
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

export interface ResearchStep {
  agentName: string;
  thought: string;
  action: string;
  observation: string;
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