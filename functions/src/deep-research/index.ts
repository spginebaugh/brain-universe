import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// Import types and services
import { ResearchRequest, ResearchResponse, researchRequestSchema } from "./types/research";
import { createDeepResearchConfig, OPENAI_API_KEY, TAVILY_API_KEY, LANGSMITH_API_KEY } from "./config";
import { ResearchFirestoreService } from "./services/research-firestore-service";

// Initialize services
const firestoreService = new ResearchFirestoreService();

/**
 * Cloud function to run deep research
 * This is an HTTP callable function that performs a complete research session
 * The research is performed within this function with Firestore tracking progress
 */
export const runDeepResearch = onCall({
  secrets: [OPENAI_API_KEY, TAVILY_API_KEY, LANGSMITH_API_KEY],
  timeoutSeconds: 3600, // 60 minutes
  cors: true,
}, async (request) => {
  try {
    // Validate auth
    if (!request.auth) {
      throw new Error("Unauthorized access");
    }

    // Get the user ID from auth
    const userId = request.auth.uid;

    logger.info("Deep research request received", {
      uid: userId,
    });

    // Get input data from request and validate with Zod
    const rawInput = request.data as ResearchRequest;

    // Add userId to the request
    const input: ResearchRequest = {
      ...rawInput,
      userId,
    };

    // Validate the input
    const validatedInput = researchRequestSchema.parse(input);

    // Create a research session in Firestore
    const session = await firestoreService.createSession(validatedInput);

    logger.info("Research session created", {
      uid: userId,
      sessionId: session.id,
    });

    // Create config using secrets
    const config = createDeepResearchConfig();

    // Create response object
    const response: ResearchResponse = {
      success: true,
      sessionId: session.id,
    };

    // Import the research service
    const { runResearchProcess } = await import("./services/research-service");

    // Return a promise chain that includes the long-running work
    return runResearchProcess(userId, session.id, config, firestoreService)
      .then(() => {
        logger.info("Research process completed successfully", {
          uid: userId,
          sessionId: session.id,
        });
        return response;
      })
      .catch((error) => {
        logger.error("Research process failed", {
          uid: userId,
          sessionId: session.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Update session with error
        return firestoreService.failSession(
          userId,
          session.id,
          error instanceof Error ? error.message : "Unknown error",
        ).then(() => {
          return {
            success: false,
            sessionId: session.id,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        });
      });
  } catch (error) {
    logger.error("Deep research request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const response: ResearchResponse = {
      success: false,
      sessionId: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return response;
  }
});
