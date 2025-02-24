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
  ProgressEvent,
  RESEARCH_STEPS,
  ResearchStep
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
    console.log('Received event:', event);

    addEvent(sessionId, event);

    if (event.type === 'error') {
      const errorEvent = event as ErrorEvent;
      setError(errorEvent.error);
      setIsLoading(false);
    } else if (event.type === 'progress') {
      const progressEvent = event as ProgressEvent;
      console.log('Progress event sections:', progressEvent.sections);
      
      if (progressEvent.sections.length > 0) {
        const session = getSession(sessionId);
        console.log('Current session:', session);
        
        if (session) {
          // Get existing sections that aren't being updated
          const existingSections = session.state.completedSections.filter(
            existingSection => !progressEvent.sections.some(
              newSection => newSection.title === existingSection.title
            )
          );

          // Combine existing sections with new ones
          const updatedSections = [
            ...existingSections,
            ...progressEvent.sections.map(section => ({
              ...section,
              step: progressEvent.step,
              timestamp: new Date().toISOString(),
              // Set status based on the step
              status: progressEvent.step === RESEARCH_STEPS.WRITING || 
                     progressEvent.step === RESEARCH_STEPS.COMPLETE ? 
                     'done' as const : 'in_progress' as const
            }))
          ];

          // Sort sections to maintain consistent order
          updatedSections.sort((a, b) => {
            const stepOrder: Record<ResearchStep, number> = {
              [RESEARCH_STEPS.PLANNING]: 0,
              [RESEARCH_STEPS.RESEARCH]: 1,
              [RESEARCH_STEPS.WRITING]: 2,
              [RESEARCH_STEPS.COMPLETE]: 3
            };
            const aStep = a.step || RESEARCH_STEPS.RESEARCH;
            const bStep = b.step || RESEARCH_STEPS.RESEARCH;
            return stepOrder[aStep] - stepOrder[bStep];
          });

          updateSession(sessionId, {
            ...session,
            state: {
              ...session.state,
              completedSections: updatedSections
            },
            isComplete: progressEvent.isFinalOutput || false,
            currentStep: progressEvent.step
          });
          
          console.log('Updated session:', getSession(sessionId));
        }
      }

      // Only set loading to false when we receive the final output
      if (progressEvent.isFinalOutput) {
        setIsLoading(false);
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
        events: [],
        isComplete: false,
        currentStep: undefined
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