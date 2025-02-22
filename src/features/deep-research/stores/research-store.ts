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
  
  addSession: (id, session) => 
    set((state) => ({
      sessions: new Map(state.sessions).set(id, session)
    })),
    
  updateSession: (id, updates) => 
    set((state) => {
      const sessions = new Map(state.sessions);
      const currentSession = sessions.get(id);
      if (currentSession) {
        sessions.set(id, { ...currentSession, ...updates });
      }
      return { sessions };
    }),
    
  addEvent: (id, event) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(id);
      if (session) {
        sessions.set(id, {
          ...session,
          events: [...session.events, event]
        });
      }
      return { sessions };
    }),
    
  setCurrentSession: (id) => set({ currentSession: id }),
  
  getSession: (id) => get().sessions.get(id),
  
  reset: () => set({ sessions: new Map(), currentSession: undefined })
})); 