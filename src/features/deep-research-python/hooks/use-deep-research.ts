'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  DeepResearchInput, 
  DeepResearchResponse, 
  DeepResearchState, 
  ResearchStep, 
  ResearchSource, 
  ResearchEvent 
} from '../types/deep-research-types';
import { DeepResearchService } from '../services/deep-research-service';

export const useDeepResearch = () => {
  const [state, setState] = useState<DeepResearchState>({
    isLoading: false,
    error: null,
    requiresFeedback: false,
    feedbackPrompt: null,
    result: {
      finalAnswer: '',
      steps: [],
      sources: [],
    },
  });

  // Keep track of active research to cancel if component unmounts
  const activeResearchRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeResearchRef.current = false;
    };
  }, []);

  const handleEvent = useCallback((event: ResearchEvent) => {
    console.log('Handling event in hook:', event);
    
    if (!activeResearchRef.current) return;

    setState((prev) => {
      const newState = { ...prev };

      switch (event.type) {
        case 'interrupt':
          newState.requiresFeedback = event.requires_feedback;
          newState.feedbackPrompt = event.value;
          newState.isLoading = false; // Pause loading while waiting for feedback
          break;

        case 'error':
          newState.error = event.error;
          newState.isLoading = false;
          break;

        case 'progress':
          // Ensure result object exists
          if (!newState.result) {
            newState.result = {
              finalAnswer: '',
              steps: [],
              sources: [],
            };
          }

          // Update final answer if content is provided
          if (event.content) {
            newState.result = {
              ...newState.result,
              finalAnswer: event.content,
            };
          }

          // Add research step if thought is provided
          if (event.thought) {
            const step: ResearchStep = {
              agentName: event.agent || 'Researcher',
              thought: event.thought,
              action: event.action,
              observation: event.observation,
            };
            newState.result = {
              ...newState.result,
              steps: [...newState.result.steps, step],
            };
          }

          // Add source if provided
          if (event.source) {
            const source: ResearchSource = {
              title: event.source.title || 'Unknown',
              url: event.source.url || '',
              content: event.source.content || '',
            };
            newState.result = {
              ...newState.result,
              sources: [...newState.result.sources, source],
            };
          }
          break;

        default:
          console.warn('Unknown event type:', event);
      }

      console.log('Updated state:', newState);
      return newState;
    });
  }, []);

  const provideFeedback = useCallback(async (feedback: boolean | string): Promise<DeepResearchResponse> => {
    setState(prev => ({
      ...prev,
      requiresFeedback: false,
      feedbackPrompt: null,
      isLoading: true, // Resume loading after feedback
    }));

    try {
      // Pass the handleEvent callback to continue receiving updates
      const response = await DeepResearchService.provideFeedback(feedback, handleEvent);
      
      if (!response.success) {
        throw new Error(response.error || 'Feedback failed');
      }

      return response;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }, [handleEvent]);

  const performResearch = useCallback(async (input: DeepResearchInput): Promise<DeepResearchResponse> => {
    // Reset active research flag
    activeResearchRef.current = true;

    setState((prev) => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      requiresFeedback: false,
      feedbackPrompt: null,
      result: {
        finalAnswer: '',
        steps: [],
        sources: [],
      },
    }));

    try {
      const response = await DeepResearchService.research(input, handleEvent);
      
      if (!response.success) {
        throw new Error(response.error || 'Research failed');
      }

      if (activeResearchRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }

      return response;
    } catch (error) {
      if (activeResearchRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        }));
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }, [handleEvent]);

  return {
    ...state,
    performResearch,
    provideFeedback,
  };
}; 