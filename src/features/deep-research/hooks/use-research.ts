"use client";

import { useState, useCallback } from 'react';
import { useResearchStore } from '../stores/research-store';
import { ResearchService } from '../services/research-service';
import { config } from '../config';
import {
  ResearchRequest,
  FeedbackRequest,
  ResearchEvent,
  ErrorEvent,
  Section,
  ResearchState,
  ResearchConfig
} from '../types/research';

const researchService = new ResearchService();

interface UseResearchReturn {
  isLoading: boolean;
  error: string | null;
  sections: Section[];
  currentSessionId: string | null;
  startResearch: (request: ResearchRequest) => Promise<void>;
  provideFeedback: (feedback: string) => Promise<void>;
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
  
  const { addSession, addEvent, getSession } = useResearchStore();

  const handleEvent = useCallback((event: ResearchEvent, sessionId: string) => {
    addEvent(sessionId, event);

    if (event.type === 'error') {
      const errorEvent = event as ErrorEvent;
      setError(errorEvent.error);
      setIsLoading(false);
    }
  }, [addEvent]);

  const startResearch = useCallback(async (request: ResearchRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      for await (const event of researchService.startResearch(request)) {
        handleEvent(event, event.sessionId);
        if (!currentSessionId) {
          setCurrentSessionId(event.sessionId);
          addSession(event.sessionId, {
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
              threadId: event.sessionId,
              searchApi: 'tavily',
              plannerProvider: 'openai',
              maxSearchDepth: 1,
              plannerModel: 'gpt-4',
              numberOfQueries: 2,
              writerModel: 'gpt-4',
              openai: config.openai,
              tavily: config.tavily,
              langsmith: config.langsmith
            },
            events: []
          });
        }
      }
    } catch (error: unknown) {
      const e = error as Error;
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [handleEvent, currentSessionId, addSession]);

  const provideFeedback = useCallback(async (feedback: string) => {
    if (!currentSessionId) {
      setError('No active research session');
      return;
    }

    setIsLoading(true);
    setError(null);

    const request: FeedbackRequest = {
      sessionId: currentSessionId,
      feedback
    };

    try {
      for await (const event of researchService.provideFeedback(request)) {
        handleEvent(event, currentSessionId);
      }
    } catch (error: unknown) {
      const e = error as Error;
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, handleEvent]);

  // Get sections from current session
  const sections = currentSessionId 
    ? getSession(currentSessionId)?.state.sections || []
    : [];

  return {
    isLoading,
    error,
    sections,
    currentSessionId,
    startResearch,
    provideFeedback,
    getSession
  };
} 