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
 * This is an HTTP callable function that starts a research session
 * The actual research is performed within this function, and progress is tracked in Firestore
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

    // Create response - we'll start the actual research process in a background task
    const response: ResearchResponse = {
      success: true,
      sessionId: session.id,
    };

    // Start the research process in the background (using a top-level await)
    (async () => {
      try {
        // Import the actual research service - we'll implement this in another file
        // This is imported here to avoid circular dependencies
        const { runResearchProcess } = await import("./services/research-service");

        // Run the research process
        await runResearchProcess(
          userId,
          session.id,
          config,
          firestoreService,
        );

        logger.info("Research process completed successfully", {
          uid: userId,
          sessionId: session.id,
        });
      } catch (error) {
        logger.error("Research process failed", {
          uid: userId,
          sessionId: session.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Update session with error
        await firestoreService.failSession(
          userId,
          session.id,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    })();

    // Return the response immediately
    return response;
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
