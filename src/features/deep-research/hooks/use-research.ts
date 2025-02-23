"use client";

import { useState, useCallback } from 'react';
import { useResearchStore } from '../stores/research-store';
import { ResearchService } from '../services/research-service';
import { config } from '../config';
import {
  ResearchRequest,
  ResearchEvent,
  ErrorEvent,
  Section,
  ResearchState,
  ResearchConfig,
  ProgressEvent
} from '../types/research';
import { v4 as uuidv4 } from 'uuid';

const researchService = new ResearchService();

interface UseResearchReturn {
  isLoading: boolean;
  error: string | null;
  sections: Section[];
  currentSessionId: string | null;
  startResearch: (request: ResearchRequest) => Promise<void>;
  getSession: (sessionId: string) => { 
    state: ResearchState;
    config: ResearchConfig;
    events: ResearchEvent[];
  } | undefined;
}

export function useResearch(): UseResearchReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const { addSession, addEvent, getSession, updateSession } = useResearchStore();

  const handleEvent = useCallback((event: ResearchEvent, sessionId: string) => {
    console.log('Received event:', event); // Debug log

    addEvent(sessionId, event);

    if (event.type === 'error') {
      const errorEvent = event as ErrorEvent;
      setError(errorEvent.error);
      setIsLoading(false);
    } else if (event.type === 'progress') {
      const progressEvent = event as ProgressEvent;
      console.log('Progress event sections:', progressEvent.sections); // Debug log
      
      if (progressEvent.sections.length > 0) {
        const session = getSession(sessionId);
        console.log('Current session:', session); // Debug log
        
        if (session) {
          // Directly add all sections to completedSections
          updateSession(sessionId, {
            ...session,
            state: {
              ...session.state,
              completedSections: progressEvent.sections
            }
          });
          
          console.log('Updated session:', getSession(sessionId)); // Debug log
        }
      }
    }
  }, [addEvent, getSession, updateSession]);

  const startResearch = useCallback(async (request: ResearchRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionId = uuidv4();
      // Initialize session first
      addSession(sessionId, {
        state: {
          topic: request.query,
          numberOfMainSections: request.numberOfMainSections || 6,
          sections: [],
          section: null,
          searchIterations: 0,
          searchQueries: [],
          sourceStr: '',
          completedSections: [],
          reportSectionsFromResearch: ''
        },
        config: {
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
        },
        events: []
      });
      setCurrentSessionId(sessionId);

      for await (const event of researchService.startResearch({ ...request, sessionId })) {
        handleEvent(event, event.sessionId);
      }
    } catch (error: unknown) {
      const e = error as Error;
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [handleEvent, addSession]);

  // Get only completed sections
  const sections = currentSessionId 
    ? getSession(currentSessionId)?.state.completedSections || []
    : [];

  return {
    isLoading,
    error,
    sections,
    currentSessionId,
    startResearch,
    getSession
  };
} 