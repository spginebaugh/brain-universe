export interface ResearchStep {
  agentName: string;
  thought: string;
  action?: string;
  observation?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  content: string;
}

export interface Section {
  title: string;
  content: string;
  subsections?: Section[];
}

export interface BaseResearchEvent {
  type?: 'interrupt' | 'error' | 'progress';
}

export interface InterruptEvent extends BaseResearchEvent {
  type: 'interrupt';
  value: string;
  resumable: boolean;
  requires_feedback: boolean;
}

export interface ErrorEvent extends BaseResearchEvent {
  type: 'error';
  error: string;
}

export interface ProgressEvent extends BaseResearchEvent {
  type: 'progress';
  content?: string;
  thought?: string;
  action?: string;
  observation?: string;
  agent?: string;
  source?: {
    title?: string;
    url?: string;
    content?: string;
  };
  section?: Section;
  sections?: Section[];
}

export type ResearchEvent = InterruptEvent | ErrorEvent | ProgressEvent;

export interface DeepResearchInput {
  query: string;
  maxIterations?: number;
  context?: string;
}

export interface DeepResearchResponse {
  success: boolean;
  data?: {
    finalAnswer: string;
    steps: ResearchStep[];
    sources?: ResearchSource[];
  };
  error?: string;
}

export interface DeepResearchState {
  isLoading: boolean;
  error: string | null;
  requiresFeedback: boolean;
  feedbackPrompt: string | null;
  result: {
    finalAnswer: string;
    steps: ResearchStep[];
    sources: ResearchSource[];
  } | null;
} 