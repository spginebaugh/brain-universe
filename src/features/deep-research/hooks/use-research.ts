"use client";

import { useState, useCallback, useEffect } from 'react';
import {
  ResearchService,
  ResearchRequest,
  ResearchSessionData,
} from '../services/research-service';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Chapter } from '../types/research';

interface UseResearchReturn {
  isLoading: boolean;
  error: string | null;
  progress: number;
  currentPhase: string;
  sessionId: string | null;
  chapters: Chapter[];
  startResearch: (request: ResearchRequest) => Promise<void>;
}

/**
 * Hook to interact with the deep research functionality
 * This now works with Firebase Cloud Functions rather than local processing
 */
export function useResearch(): UseResearchReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');
  const [sessionData, setSessionData] = useState<ResearchSessionData | null>(null);
  
  // Get the user ID
  const userId = useAuthStore(state => state.user?.uid);
  
  // Create service ref
  const serviceRef = useState(() => new ResearchService())[0];
  
  // Cleanup function for Firebase listeners
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
  
  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [unsubscribe]);

  /**
   * Starts a new research process
   */
  const startResearch = useCallback(async (request: ResearchRequest) => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setCurrentPhase('Starting research...');

    try {
      // Call the cloud function
      const newSessionId = await serviceRef.startResearch(request);
      setSessionId(newSessionId);
      
      // Set up tracking
      if (unsubscribe) {
        unsubscribe();
      }
      
      const stopTracking = serviceRef.trackResearchProgress(
        newSessionId,
        (data) => {
          // Update the session data
          setSessionData(data);
          
          // Update progress percentage
          const progressPercent = serviceRef.calculateProgressPercentage(data);
          setProgress(progressPercent);
          
          // Update phase label
          const phaseLabel = serviceRef.getPhaseLabel(data);
          setCurrentPhase(phaseLabel);
          
          // Update loading state
          if (data.status === 'completed' || data.status === 'error') {
            setIsLoading(false);
          }
          
          // Update error state
          if (data.status === 'error' && data.error) {
            setError(data.error);
          }
        },
        (error) => {
          console.error('Error tracking research progress:', error);
          setError(error.message);
          setIsLoading(false);
        }
      );
      
      setUnsubscribe(() => stopTracking);
      
    } catch (error) {
      console.error('Error starting research:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [userId, serviceRef, unsubscribe]);

  return {
    isLoading,
    error,
    progress,
    currentPhase,
    sessionId,
    chapters: sessionData?.chapters || [],
    startResearch
  };
}