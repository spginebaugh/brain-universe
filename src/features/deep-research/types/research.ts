import { z } from 'zod';

// Base types
export interface ResearchRequest {
  query: string;
  numberOfChapters?: number;
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

export interface SubTopic {
  title: string;
  description: string;
  content: string;
  sources: ResearchSource[];
}

export interface ChapterContent {
  overview: string;
  subTopics: Record<string, SubTopic>;
}

export interface SearchResult {
  title: string;
  content: string;
  url: string;
  targetSubTopic?: string;
}

export interface SearchQuery {
  query: string;
  purpose: string;
  targetSubTopic?: string;
}

export interface Chapter {
  title: string;
  description: string;
  subTopicNames: string[];
  status: 'pending' | 'researching' | 'writing' | 'completed';
  phase?: ResearchPhase;
  timestamp?: string;
  
  // Research data (populated during research phase)
  research?: {
    queries: SearchQuery[];
    results: SearchResult[];
  };
  
  // Content data (populated during writing phase)
  content?: ChapterContent;
}

// Phase types
export const RESEARCH_PHASES = {
  INITIAL_RESEARCH: 'INITIAL_RESEARCH',
  PLANNING: 'PLANNING',
  CHAPTER_RESEARCH: 'CHAPTER_RESEARCH',
  CHAPTER_WRITING: 'CHAPTER_WRITING',
  COMPLETE: 'COMPLETE'
} as const;

export type ResearchPhase = typeof RESEARCH_PHASES[keyof typeof RESEARCH_PHASES];

// For backward compatibility during transition
export const RESEARCH_STEPS = RESEARCH_PHASES;
export type ResearchStep = ResearchPhase;

// Event types
export interface BaseEvent {
  type: string;
  sessionId: string;
  phase: ResearchPhase;
  isProcessComplete?: boolean;
  isFinalOutput?: boolean;
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  content: string | null;
  chapters: Chapter[];
  phaseInfo: ResearchPhaseInfo[];
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

// Renamed from ResearchStepInfo to ResearchPhaseInfo
export interface ResearchPhaseInfo {
  action: string;
  thought: string;
  observation: string;
}

// State types
export interface ResearchState {
  // Basic information
  researchSubject: string;
  numberOfChapters: number;
  
  // Research phase data
  initialResearch: {
    queries: string[];
    results: SearchResult[];
  };
  
  // Planning phase data
  plannedChapters: Chapter[];
  
  // Chapter progress tracking
  chapters: Record<string, Chapter>; // Map of chapter title to chapter data
  chapterOrder: string[]; // Order of chapters
  currentChapterTitle: string | null;
  
  // Overall progress tracking
  currentPhase: ResearchPhase;
  progress: {
    totalChapters: number;
    completedChapters: number;
  };
}

// Phase result types
export interface BasePhaseResult {
  phase: ResearchPhase;
  isPhaseComplete: boolean;
  isFinalOutput?: boolean;
}

export interface InitialResearchPhaseResult extends BasePhaseResult {
  phase: typeof RESEARCH_PHASES.INITIAL_RESEARCH;
  queries: string[];
  results: SearchResult[];
}

export interface PlanningPhaseResult extends BasePhaseResult {
  phase: typeof RESEARCH_PHASES.PLANNING;
  plannedChapters: Chapter[];
}

export interface ChapterResearchPhaseResult extends BasePhaseResult {
  phase: typeof RESEARCH_PHASES.CHAPTER_RESEARCH;
  chapterTitle: string;
  queries: SearchQuery[];
  results: SearchResult[];
}

export interface ChapterWritingPhaseResult extends BasePhaseResult {
  phase: typeof RESEARCH_PHASES.CHAPTER_WRITING;
  chapterTitle: string;
  content: ChapterContent;
}

export interface CompletePhaseResult extends BasePhaseResult {
  phase: typeof RESEARCH_PHASES.COMPLETE;
}

export type PhaseResult = 
  | InitialResearchPhaseResult
  | PlanningPhaseResult
  | ChapterResearchPhaseResult
  | ChapterWritingPhaseResult
  | CompletePhaseResult;

// For backward compatibility during transition
export type StepResult = PhaseResult;

// Zod schemas for validation
export const researchRequestSchema = z.object({
  query: z.string().min(1),
  numberOfChapters: z.number().optional().default(6)
});

export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().min(1)
});

export type ResearchEvent = ProgressEvent | ErrorEvent | InterruptEvent;

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