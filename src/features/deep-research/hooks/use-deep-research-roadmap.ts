import { useCallback, useEffect, useRef } from 'react';
import { useResearch } from './use-research';
import { useDeepResearchRoadmapStore } from '../stores/deep-research-roadmap-store';
import { RESEARCH_PHASES, ResearchRequest, ResearchState } from '../types/research';

interface UseDeepResearchRoadmapParams {
  onPhaseChange?: (phase: string, progress: number) => void;
}

export function useDeepResearchRoadmap({
  onPhaseChange
}: UseDeepResearchRoadmapParams = {}) {
  // Get the research functionality
  const { 
    startResearch, 
    error: researchError, 
    currentSessionId,
    getSession
  } = useResearch();

  // Get store state and actions
  const { 
    isLoading,
    error, 
    sessionId,
    researchState, 
    progress,
    currentPhaseLabel,
    cancelRequested,
    setIsLoading,
    setError,
    setSessionId,
    setResearchState,
    setProgress,
    setCurrentPhaseLabel,
    reset
  } = useDeepResearchRoadmapStore();

  // Track interval for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate progress based on research state
  const calculateProgress = useCallback((state: ResearchState): number => {
    if (!state) return 0;
    
    switch(state.currentPhase) {
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 10;
      
      case RESEARCH_PHASES.PLANNING:
        return 20;
      
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
      case RESEARCH_PHASES.CHAPTER_WRITING: {
        if (state.progress.totalChapters === 0) return 20;
        const completedPercentage = state.progress.completedChapters / state.progress.totalChapters;
        // Scale from 20% to 90% based on chapter completion
        return 20 + (completedPercentage * 70);
      }
      
      case RESEARCH_PHASES.COMPLETE:
        return 100;
        
      default:
        return 0;
    }
  }, []);

  // Get phase label based on research state
  const getPhaseLabel = useCallback((state: ResearchState): string => {
    if (!state) return 'Initializing';
    
    switch(state.currentPhase) {
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 'Researching Topic';
      
      case RESEARCH_PHASES.PLANNING:
        return 'Planning Chapters';
      
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
        return `Researching Chapter: ${state.currentChapterTitle || ''}`;
      
      case RESEARCH_PHASES.CHAPTER_WRITING:
        return `Writing Chapter: ${state.currentChapterTitle || ''}`;
      
      case RESEARCH_PHASES.COMPLETE:
        return 'Research Complete';
        
      default:
        return 'Processing';
    }
  }, []);

  // Poll for research updates
  const pollResearch = useCallback(() => {
    if (!sessionId) return;
    
    const session = getSession(sessionId);
    if (!session) return;
    
    const { state } = session;
    if (!state) return;

    setResearchState(state);
    
    // Calculate progress
    const newProgress = calculateProgress(state);
    setProgress(newProgress);
    
    // Update phase label
    const newPhaseLabel = getPhaseLabel(state);
    setCurrentPhaseLabel(newPhaseLabel);
    
    // Call onPhaseChange if provided and phase changed
    if (onPhaseChange && currentPhaseLabel !== newPhaseLabel) {
      onPhaseChange(newPhaseLabel, newProgress);
    }
    
    // Check if research is complete
    if (state.currentPhase === RESEARCH_PHASES.COMPLETE) {
      clearPollingInterval();
      setIsLoading(false);
    }
  }, [
    sessionId, 
    getSession, 
    setResearchState, 
    calculateProgress, 
    setProgress, 
    getPhaseLabel, 
    setCurrentPhaseLabel, 
    onPhaseChange, 
    currentPhaseLabel, 
    setIsLoading
  ]);

  // Setup and clear polling interval
  const setupPollingInterval = useCallback(() => {
    clearPollingInterval();
    pollingIntervalRef.current = setInterval(pollResearch, 1000);
  }, [pollResearch]);

  const clearPollingInterval = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Start deep research roadmap generation
  const startDeepResearch = useCallback(async (request: ResearchRequest) => {
    reset();
    setIsLoading(true);
    
    try {
      // First, perform the research using the useResearch hook's startResearch
      // This will make the cloud function API call
      console.log('Starting research process');
      await startResearch(request);
      
      // After research is started, update the sessionId in our store
      if (currentSessionId) {
        console.log('Setting session ID:', currentSessionId);
        setSessionId(currentSessionId);
      } else {
        console.warn('No current session ID available after starting research');
      }
      
      // Start polling for updates
      setupPollingInterval();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start deep research';
      console.error('Error in startDeepResearch:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [
    reset, 
    setIsLoading, 
    startResearch, 
    setSessionId, 
    currentSessionId, 
    setupPollingInterval, 
    setError
  ]);

  // Handle errors
  useEffect(() => {
    if (researchError) {
      setError(researchError);
    }
  }, [researchError, setError]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, [clearPollingInterval]);

  return {
    // State
    isLoading,
    error,
    sessionId,
    researchState,
    progress,
    currentPhaseLabel,
    cancelRequested,
    
    // Actions
    startDeepResearch,
    reset
  };
} 