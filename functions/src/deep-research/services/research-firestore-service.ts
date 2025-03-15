import { getFirestore } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import {
  ResearchSession,
  ResearchRequest,
  ResearchState,
  ResearchPhase,
  PhaseResult,
} from "../types/research";

// Initialize Firestore
const db = getFirestore();

/**
 * Research Firestore Service
 */
export class ResearchFirestoreService {
  /**
   * Creates a new research session in Firestore
   */
  async createSession(request: ResearchRequest): Promise<ResearchSession> {
    const sessionId = request.sessionId || uuidv4();

    // Create initial research state
    const initialState: ResearchState = {
      researchSubject: request.query,
      numberOfChapters: request.numberOfChapters || 6,
      initialResearch: {
        queries: [],
        results: [],
      },
      plannedChapters: [],
      chapters: {},
      chapterOrder: [],
      currentChapterTitle: null,
      currentPhase: "INITIAL_RESEARCH" as ResearchPhase,
      progress: {
        totalChapters: 0,
        completedChapters: 0,
      },
    };

    // Create session document
    const session: ResearchSession = {
      id: sessionId,
      userId: request.userId,
      query: request.query,
      numberOfChapters: request.numberOfChapters || 6,
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentPhase: "INITIAL_RESEARCH" as ResearchPhase,
      state: initialState,
    };

    // Save to Firestore
    const sessionRef = db.collection("users").doc(request.userId)
      .collection("research").doc(sessionId);

    await sessionRef.set(session);

    return session;
  }

  /**
   * Updates a research session with the result of a phase
   */
  async updateSessionWithPhaseResult(
    userId: string,
    sessionId: string,
    phaseResult: PhaseResult,
    newState: ResearchState,
  ): Promise<void> {
    const sessionRef = db.collection("users").doc(userId)
      .collection("research").doc(sessionId);

    // Update the session with the new state and phase info
    await sessionRef.update({
      updatedAt: new Date().toISOString(),
      currentPhase: phaseResult.phase,
      state: newState,
      // Also store the phase result for detailed tracking
      [`phaseResults.${phaseResult.phase}`]: phaseResult,
    });
  }

  /**
   * Marks a research session as completed
   */
  async completeSession(
    userId: string,
    sessionId: string,
    finalState: ResearchState,
  ): Promise<void> {
    const sessionRef = db.collection("users").doc(userId)
      .collection("research").doc(sessionId);

    await sessionRef.update({
      status: "completed",
      updatedAt: new Date().toISOString(),
      state: finalState,
    });
  }

  /**
   * Marks a research session as failed with an error
   */
  async failSession(
    userId: string,
    sessionId: string,
    error: string,
  ): Promise<void> {
    const sessionRef = db.collection("users").doc(userId)
      .collection("research").doc(sessionId);

    await sessionRef.update({
      status: "error",
      error,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Gets a research session by ID
   */
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<ResearchSession | null> {
    const sessionRef = db.collection("users").doc(userId)
      .collection("research").doc(sessionId);

    const doc = await sessionRef.get();
    if (!doc.exists) {
      return null;
    }

    return doc.data() as ResearchSession;
  }

  /**
   * Updates the heartbeat timestamp for a research session
   * This is used to track if the function is still running
   */
  async updateHeartbeat(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const sessionRef = db.collection("users").doc(userId)
      .collection("research").doc(sessionId);

    await sessionRef.update({
      lastHeartbeat: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
