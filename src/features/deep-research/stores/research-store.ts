"use client";

import { create } from 'zustand';
import { ResearchState, ResearchConfig, ResearchEvent } from '../types/research';

interface ResearchSession {
  state: ResearchState;
  config: ResearchConfig;
  events: ResearchEvent[];
}

interface ResearchStore {
  sessions: Map<string, ResearchSession>;
  currentSession?: string;
  addSession: (id: string, session: ResearchSession) => void;
  updateSession: (id: string, updates: Partial<ResearchSession>) => void;
  addEvent: (id: string, event: ResearchEvent) => void;
  setCurrentSession: (id: string) => void;
  getSession: (id: string) => ResearchSession | undefined;
  reset: () => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  sessions: new Map(),
  
  addSession: (id, session) => {
    console.log('Adding session:', id, session);
    set((state) => ({
      sessions: new Map(state.sessions).set(id, session)
    }));
  },
    
  updateSession: (id, updates) => {
    console.log('Updating session:', id, updates);
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
        console.log('Updated session:', updatedSession);
        sessions.set(id, updatedSession);
      }
      return { sessions };
    });
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
          state: {
            ...session.state,
            completedSections: event.type === 'progress' ? event.sections : session.state.completedSections
          }
        };
        console.log('Session after adding event:', updatedSession);
        sessions.set(id, updatedSession);
      }
      return { sessions };
    });
  },
    
  setCurrentSession: (id) => set({ currentSession: id }),
  
  getSession: (id) => {
    const session = get().sessions.get(id);
    console.log('Getting session:', id, session);
    return session;
  },
  
  reset: () => set({ sessions: new Map(), currentSession: undefined })
})); 