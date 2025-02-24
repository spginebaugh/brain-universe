"use client";

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { 
  ResearchState, 
  ResearchConfig, 
  ResearchEvent, 
  ResearchPhase, 
  RESEARCH_PHASES,
  Chapter,
  ProgressEvent,
  ErrorEvent,
  ResearchRequest,
  PhaseResult,
  ResearchPhaseInfo,
  InitialResearchPhaseResult,
  PlanningPhaseResult,
  ChapterResearchPhaseResult,
  ChapterWritingPhaseResult
} from '../types/research';
import { config as appConfig } from '../config';

interface ResearchSession {
  state: ResearchState;
  config: ResearchConfig;
  events: ResearchEvent[];
  currentPhase?: ResearchPhase;
  isComplete: boolean;
  completedAt?: Date;
}

interface ResearchStore {
  sessions: Map<string, ResearchSession>;
  currentSession?: string;
  
  // Session management
  createSession: (request: ResearchRequest) => string;
  addSession: (id: string, session: ResearchSession) => void;
  updateSession: (id: string, updates: Partial<ResearchSession>) => void;
  setCurrentSession: (id: string) => void;
  getSession: (id: string) => ResearchSession | undefined;
  
  // Event handling
  addEvent: (id: string, event: ResearchEvent) => void;
  processPhaseResult: (sessionId: string, phaseResult: PhaseResult) => ResearchEvent;
  
  // Utility methods
  getActionForPhase: (phase: ResearchPhase) => string;
  getThoughtForPhase: (phase: ResearchPhase, chapters: Chapter[]) => string;
  getObservationForPhase: (phase: ResearchPhase, chapters: Chapter[]) => string;
  
  reset: () => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  sessions: new Map(),
  
  createSession: (request: ResearchRequest) => {
    const sessionId = request.sessionId || uuidv4();
    const defaultConfig: ResearchConfig = {
      threadId: uuidv4(),
      searchApi: 'tavily',
      plannerProvider: 'openai',
      maxSearchDepth: 1,
      plannerModel: 'gpt-4o',
      numberOfQueries: 2,
      writerModel: 'gpt-4o',
      openai: appConfig.openai,
      tavily: appConfig.tavily,
      langsmith: appConfig.langsmith
    };
    
    const initialState: ResearchState = {
      researchSubject: request.query,
      numberOfChapters: request.numberOfChapters || 6,
      plannedChapters: [],
      chapters: {},
      chapterOrder: [],
      currentChapterTitle: null,
      currentPhase: RESEARCH_PHASES.INITIAL_RESEARCH,
      initialResearch: {
        queries: [],
        results: []
      },
      progress: {
        totalChapters: request.numberOfChapters || 6,
        completedChapters: 0
      }
    };
    
    const session: ResearchSession = {
      state: initialState,
      config: defaultConfig,
      events: [],
      isComplete: false,
      currentPhase: RESEARCH_PHASES.INITIAL_RESEARCH
    };
    
    // Add the session to the store
    get().addSession(sessionId, session);
    
    // Set as current session
    get().setCurrentSession(sessionId);
    
    console.log('Session created:', sessionId);
    console.log('Current sessions:', [...get().sessions.keys()]);
    
    return sessionId;
  },
  
  addSession: (id, session) => {
    console.log('Adding session:', id);
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(id, {
        ...session,
        isComplete: false,
        currentPhase: session.currentPhase || RESEARCH_PHASES.INITIAL_RESEARCH
      });
      return { 
        sessions: newSessions
      };
    });
    console.log('Session added, current sessions:', [...get().sessions.keys()]);
  },
    
  updateSession: (id, updates) => {
    console.log('Updating session:', id);
    set((state) => {
      const sessions = new Map(state.sessions);
      const currentSession = sessions.get(id);
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          ...updates,
          state: {
            ...currentSession.state,
            ...(updates.state || {})
          }
        };
        sessions.set(id, updatedSession);
        return { sessions };
      }
      console.warn('Session not found for update:', id);
      return state;
    });
  },
  
  getActionForPhase: (phase: ResearchPhase) => {
    if (phase === RESEARCH_PHASES.COMPLETE) {
      return 'Finalizing research';
    }
    switch (phase) {
      case RESEARCH_PHASES.PLANNING:
        return 'Planning chapters';
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
        return 'Gathering information';
      case RESEARCH_PHASES.CHAPTER_WRITING:
        return 'Writing content';
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 'Formulating search queries';
      default:
        return 'Processing';
    }
  },

  getThoughtForPhase: (phase: ResearchPhase, chapters: Chapter[]) => {
    if (phase === RESEARCH_PHASES.COMPLETE) {
      return 'Research process completed';
    }
    return `Processing ${chapters.length} chapter(s)`;
  },

  getObservationForPhase: (phase: ResearchPhase, chapters: Chapter[]) => {
    if (phase === RESEARCH_PHASES.COMPLETE) {
      return `Research completed with ${chapters.length} total chapters`;
    }
    return `Generated content for ${chapters.length} chapter(s)`;
  },
  
  processPhaseResult: (sessionId: string, phaseResult: PhaseResult) => {
    console.log('Processing phase result:', phaseResult);
    
    const { phase, isPhaseComplete, isFinalOutput } = phaseResult;
    
    // Get the current session
    const session = get().getSession(sessionId);
    if (!session) {
      console.error('Session not found:', sessionId);
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId,
        phase,
        error: 'Session not found'
      };
      return errorEvent;
    }
    
    // Create a new state based on the current state
    const newState = { ...session.state };
    
    // Update state based on phase type
    let chapters: Chapter[] = [];
    
    try {
      switch (phase) {
        case RESEARCH_PHASES.INITIAL_RESEARCH: {
          const result = phaseResult as InitialResearchPhaseResult;
          newState.initialResearch = {
            queries: result.queries,
            results: result.results
          };
          newState.currentPhase = RESEARCH_PHASES.INITIAL_RESEARCH;
          break;
        }
          
        case RESEARCH_PHASES.PLANNING: {
          const result = phaseResult as PlanningPhaseResult;
          const plannedChapters = result.plannedChapters;
          
          // Update state with planned chapters
          newState.plannedChapters = plannedChapters;
          newState.chapterOrder = plannedChapters.map(chapter => chapter.title);
          
          // Create a map of chapters
          const chaptersMap: Record<string, Chapter> = {};
          plannedChapters.forEach(chapter => {
            chaptersMap[chapter.title] = {
              ...chapter,
              phase: RESEARCH_PHASES.PLANNING,
              timestamp: new Date().toISOString(),
              status: 'pending'
            };
          });
          
          newState.chapters = chaptersMap;
          newState.currentPhase = RESEARCH_PHASES.PLANNING;
          newState.progress = {
            totalChapters: plannedChapters.length,
            completedChapters: 0
          };
          
          chapters = plannedChapters;
          break;
        }
          
        case RESEARCH_PHASES.CHAPTER_RESEARCH: {
          const result = phaseResult as ChapterResearchPhaseResult;
          const { chapterTitle, queries, results } = result;
          
          // Update the specific chapter
          if (newState.chapters[chapterTitle]) {
            newState.chapters[chapterTitle] = {
              ...newState.chapters[chapterTitle],
              phase: RESEARCH_PHASES.CHAPTER_RESEARCH,
              timestamp: new Date().toISOString(),
              status: 'researching',
              research: {
                queries,
                results
              }
            };
            
            newState.currentChapterTitle = chapterTitle;
            newState.currentPhase = RESEARCH_PHASES.CHAPTER_RESEARCH;
            
            chapters = [newState.chapters[chapterTitle]];
          }
          break;
        }
          
        case RESEARCH_PHASES.CHAPTER_WRITING: {
          const result = phaseResult as ChapterWritingPhaseResult;
          const { chapterTitle, content } = result;
          
          // Update the specific chapter
          if (newState.chapters[chapterTitle]) {
            newState.chapters[chapterTitle] = {
              ...newState.chapters[chapterTitle],
              phase: RESEARCH_PHASES.CHAPTER_WRITING,
              timestamp: new Date().toISOString(),
              status: 'completed',
              content
            };
            
            // Update progress
            newState.progress = {
              ...newState.progress,
              completedChapters: newState.progress.completedChapters + 1
            };
            
            // Find the next chapter to process
            const currentIndex = newState.chapterOrder.indexOf(chapterTitle);
            const nextIndex = currentIndex + 1;
            
            if (nextIndex < newState.chapterOrder.length) {
              newState.currentChapterTitle = newState.chapterOrder[nextIndex];
            } else {
              newState.currentChapterTitle = null;
              
              // If all chapters are completed, move to complete phase
              if (newState.progress.completedChapters >= newState.progress.totalChapters) {
                newState.currentPhase = RESEARCH_PHASES.COMPLETE;
              }
            }
            
            chapters = [newState.chapters[chapterTitle]];
          }
          break;
        }
          
        case RESEARCH_PHASES.COMPLETE: {
          newState.currentPhase = RESEARCH_PHASES.COMPLETE;
          
          // Get all completed chapters
          chapters = Object.values(newState.chapters).filter(
            chapter => chapter.status === 'completed'
          );
          break;
        }
      }
      
      // Update the session with the new state
      get().updateSession(sessionId, { 
        state: newState,
        currentPhase: newState.currentPhase,
        isComplete: newState.currentPhase === RESEARCH_PHASES.COMPLETE || isFinalOutput || false,
        completedAt: (newState.currentPhase === RESEARCH_PHASES.COMPLETE || isFinalOutput) ? new Date() : session.completedAt
      });
      
      // Create phase info
      const phaseInfo: ResearchPhaseInfo[] = [{
        action: get().getActionForPhase(phase),
        thought: get().getThoughtForPhase(phase, chapters),
        observation: get().getObservationForPhase(phase, chapters)
      }];
      
      // Create and return progress event
      const progressEvent: ProgressEvent = {
        type: 'progress',
        sessionId,
        phase,
        isProcessComplete: isPhaseComplete,
        isFinalOutput,
        content: null,
        chapters,
        phaseInfo
      };
      
      get().addEvent(sessionId, progressEvent);
      return progressEvent;
      
    } catch (error) {
      console.error('Error processing phase result:', error);
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId,
        phase,
        error: String(error)
      };
      get().addEvent(sessionId, errorEvent);
      return errorEvent;
    }
  },
    
  addEvent: (id, event) => {
    console.log('Adding event:', id, event);
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(id);
      if (session) {
        const updatedSession = {
          ...session,
          events: [...session.events, event],
          currentPhase: event.phase,
          isComplete: event.isFinalOutput || false,
          completedAt: event.isFinalOutput ? new Date() : session.completedAt
        };
        console.log('Session after adding event:', updatedSession);
        sessions.set(id, updatedSession);
      }
      return { sessions };
    });
  },
    
  setCurrentSession: (id) => {
    console.log('Setting current session:', id);
    set({ currentSession: id });
    console.log('Current session set to:', id);
  },
  
  getSession: (id) => {
    const session = get().sessions.get(id);
    if (!session) {
      console.warn('Session not found:', id);
      console.log('Available sessions:', [...get().sessions.keys()]);
    }
    return session;
  },
  
  reset: () => set({ sessions: new Map(), currentSession: undefined })
})); 