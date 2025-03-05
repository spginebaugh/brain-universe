import { AIRoadmapInput, AIRoadmapResponse } from "../types/ai-roadmap-types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

export class AIRoadmapService {
  public async generateRoadmap(input: AIRoadmapInput): Promise<AIRoadmapResponse> {
    try {
      // Get Firebase Functions instance
      const functions = getFunctions(getApp());
      
      // Create a callable function reference
      const generateAIRoadmap = httpsCallable<AIRoadmapInput, AIRoadmapResponse>(
        functions, 
        'generateAIRoadmap'
      );

      // Call the Firebase function
      const result = await generateAIRoadmap(input);
      
      // Return the data from the function result
      return result.data;
    } catch (error) {
      console.error("Failed to generate roadmap:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate roadmap",
      };
    }
  }
} 