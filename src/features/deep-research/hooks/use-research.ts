"use client";

import { useState, useCallback, useEffect } from 'react';
import { useResearchStore } from '../stores/research-store';
import { ResearchService } from '../services/research-service';
import {
  ResearchRequest,
  ResearchEvent,
  ErrorEvent,
  Chapter,
  ResearchState,
  ResearchConfig
} from '../types/research';

// Create a singleton instance of the service
const researchService = new ResearchService();

interface UseResearchReturn {
  isLoading: boolean;
  error: string | null;
  chapters: Chapter[];
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
  
  // Get store methods
  const { getSession, currentSession } = useResearchStore();

  // Update local state when store changes
  useEffect(() => {
    if (currentSession) {
      console.log('Current session updated:', currentSession);
      setCurrentSessionId(currentSession);
      
      const session = getSession(currentSession);
      if (session) {
        console.log('Session found:', session);
        
        // Update error state if the last event was an error
        const lastEvent = session.events[session.events.length - 1];
        if (lastEvent && lastEvent.type === 'error') {
          setError((lastEvent as ErrorEvent).error);
        } else {
          setError(null);
        }
        
        // Update loading state based on session completion
        setIsLoading(!session.isComplete);
      } else {
        console.warn('Session not found for ID:', currentSession);
      }
    }
  }, [currentSession, getSession]);

  const startResearch = useCallback(async (request: ResearchRequest) => {
    console.log('Starting research with request:', request);
    setIsLoading(true);
    setError(null);

    try {
      // The service will create a session in the store
      let eventCount = 0;
      for await (const event of researchService.startResearch(request)) {
        eventCount++;
        console.log(`Received event ${eventCount}:`, event);
        
        // Events are already processed and added to the store by the service
        if (event.type === 'error') {
          console.error('Error event received:', event);
          setError((event as ErrorEvent).error);
        }
        
        // Set loading to false when we receive the final output
        if (event.isFinalOutput) {
          console.log('Final output received, research complete');
          setIsLoading(false);
        }
      }
      
      console.log(`Research completed with ${eventCount} events`);
    } catch (error: unknown) {
      const e = error as Error;
      console.error('Error in research process:', e);
      setError(e.message);
      setIsLoading(false);
    }
  }, []);

  // Get chapters from the current session
  const chapters = currentSessionId 
    ? Object.values(getSession(currentSessionId)?.state.chapters || {})
    : [];

  return {
    isLoading,
    error,
    chapters,
    currentSessionId,
    startResearch,
    getSession
  };
} 