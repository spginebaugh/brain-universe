import { useState } from 'react';
import { AIRoadmapService } from '../services/ai-roadmap-service';
import { AIRoadmapInput, AIRoadmapResponse } from '../types/ai-roadmap-types';

export const useAIRoadmap = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiService = new AIRoadmapService();

  const generateRoadmap = async (input: AIRoadmapInput): Promise<AIRoadmapResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await aiService.generateRoadmap(input);
      
      if (!response.success) {
        setError(response.error || 'Failed to generate roadmap');
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateRoadmap,
    isLoading,
    error
  };
}; 