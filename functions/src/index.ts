/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";

// Import roadmap generation types
import { AIRoadmapInput, AIRoadmapResponse } from "./simple-roadmap-generation/types/ai-roadmap-types";
import { generateRoadmap } from "./simple-roadmap-generation/services/roadmap-service";

// Import deep research function
import { runDeepResearch } from "./deep-research";

// Define secrets
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Roadmap generation endpoint
export const generateAIRoadmap = onCall({
  secrets: [openaiApiKey],
  cors: true, // Enable CORS for all origins
}, async (request) => {
  try {
    // Validate auth
    if (!request.auth) {
      throw new Error("Unauthorized access");
    }

    logger.info("Roadmap generation request received", {
      uid: request.auth.uid,
    });

    // Get input data from request
    const input = request.data as AIRoadmapInput;

    // Input validation
    if (!input.subject || !input.numberOfTopics) {
      throw new Error("Invalid input parameters");
    }

    // Call the roadmap generation service
    const result = await generateRoadmap(input, openaiApiKey.value());

    logger.info("Roadmap generation completed successfully", {
      uid: request.auth.uid,
    });

    return result;
  } catch (error) {
    logger.error("Roadmap generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const response: AIRoadmapResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return response;
  }
});

// Export the deep research function
export { runDeepResearch };
