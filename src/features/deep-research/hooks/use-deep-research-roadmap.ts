"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { 
  DeepResearchRoadmapService, 
  RoadmapGenerationInput, 
  RoadmapGenerationProgress 
} from '../services/deep-research-roadmap-service';

interface UseDeepResearchRoadmapParams {
  onPhaseChange?: (phase: string, progress: number) => void;
}

export function useDeepResearchRoadmap({
  onPhaseChange
}: UseDeepResearchRoadmapParams = {}) {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState('Initializing');

  // Get the user ID
  const userId = useAuthStore(state => state.user?.uid);
  
  // Create service ref
  const serviceRef = useState(() => 
    userId ? new DeepResearchRoadmapService(userId) : null
  )[0];
  
  // Update service when userId changes
  useEffect(() => {
    if (!serviceRef && userId) {
      // This should never happen since the state initializer should create it,
      // but just in case, we include this check
      console.log('Creating new research service with userId:', userId);
    }
  }, [userId, serviceRef]);
  
  // Handle progress updates
  const handleProgress = useCallback((progress: RoadmapGenerationProgress) => {
    // Update state
    setProgress(progress.progress);
    setCurrentPhaseLabel(progress.phase);
    
    // Call onPhaseChange if provided
    if (onPhaseChange) {
      onPhaseChange(progress.phase, progress.progress);
    }
    
    // Handle errors
    if (progress.error) {
      setError(progress.error);
    }
    
    // Handle completion
    if (progress.isComplete) {
      setIsLoading(false);
    }
  }, [onPhaseChange]);
  
  // Start deep research roadmap generation
  const startDeepResearch = useCallback(async (
    input: RoadmapGenerationInput
  ) => {
    if (!userId || !serviceRef) {
      setError('User not authenticated');
      return;
    }
    
    setIsLoading(true);
    setProgress(0);
    setCurrentPhaseLabel('Starting research...');
    setError(null);
    
    try {
      // Start the research process
      const newSessionId = await serviceRef.startResearch(input, handleProgress);
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Failed to start deep research:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [userId, serviceRef, handleProgress]);
  
  // Cancel the research process
  const cancel = useCallback(() => {
    if (serviceRef) {
      serviceRef.cancel();
      setIsLoading(false);
      setCurrentPhaseLabel('Cancelled');
    }
  }, [serviceRef]);
  
  // Reset state
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setSessionId(null);
    setProgress(0);
    setCurrentPhaseLabel('Initializing');
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (serviceRef) {
        serviceRef.cancel();
      }
    };
  }, [serviceRef]);
  
  return {
    // State
    isLoading,
    error,
    sessionId,
    progress,
    currentPhaseLabel,
    
    // Actions
    startDeepResearch,
    cancel,
    reset
  };
}