import { v4 as uuidv4 } from 'uuid';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, onSnapshot, Unsubscribe, DocumentSnapshot } from 'firebase/firestore';
import {
  ResearchRequest,
  ResearchEvent,
  ErrorEvent,
  RESEARCH_PHASES,
  PhaseResult
} from '../types/research';
import { useResearchStore } from '../stores/research-store';
import { useAuthStore } from '@/features/auth/stores/auth-store';

interface FirebaseResearchResponse {
  success: boolean;
  sessionId: string;
  error?: string;
}

export class ResearchService {
  constructor() {}

  /**
   * Starts a research process by calling the Firebase cloud function
   * and setting up a listener for Firestore updates
   */
  async *startResearch(request: ResearchRequest): AsyncGenerator<ResearchEvent> {
    // Get a fresh reference to the store each time
    const store = useResearchStore.getState();
    const userId = useAuthStore.getState().user?.uid;
    
    if (!userId) {
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId: '',
        phase: RESEARCH_PHASES.COMPLETE,
        isProcessComplete: true,
        isFinalOutput: true,
        error: 'User not authenticated'
      };
      yield errorEvent;
      return;
    }

    const sessionId = request.sessionId || uuidv4();
    
    try {
      // Create a session in the store
      store.createSession({
        ...request,
        sessionId
      });
      
      // Call the Firebase function
      const functions = getFunctions();
      const runDeepResearch = httpsCallable<ResearchRequest, FirebaseResearchResponse>(
        functions, 
        'runDeepResearch'
      );
      
      // Call the function without waiting for it to complete
      const functionPromise = runDeepResearch({
        query: request.query,
        numberOfChapters: request.numberOfChapters
      });
      
      // Set up a listener for Firestore updates
      const db = getFirestore();
      const researchDocRef = doc(
        db, 
        'users', 
        userId, 
        'research', 
        sessionId
      );
      
      // Use a Promise to control the generator flow
      yield* this.setupFirestoreListener(researchDocRef, sessionId);
      
      // Wait for the function call to complete (this won't block the generator)
      const result = await functionPromise;
      console.log('Function completed with result:', result.data);
      
      if (!result.data.success) {
        const errorEvent: ErrorEvent = {
          type: 'error',
          sessionId,
          phase: RESEARCH_PHASES.COMPLETE,
          isProcessComplete: true,
          isFinalOutput: true,
          error: result.data.error || 'Unknown error'
        };
        yield errorEvent;
      }
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Research error:", e);
      
      const errorEvent: ErrorEvent = {
        type: 'error',
        sessionId,
        phase: RESEARCH_PHASES.COMPLETE,
        isProcessComplete: true,
        isFinalOutput: true,
        error: e.message
      };
      yield errorEvent;
    }
  }
  
  /**
   * Sets up a listener for Firestore document updates and yields events as they arrive
   */
  private async *setupFirestoreListener(
    researchDocRef: any, 
    sessionId: string
  ): AsyncGenerator<ResearchEvent> {
    const store = useResearchStore.getState();
    
    // Create a promise that will resolve when the first event is received
    // or reject after a timeout
    return new Promise<AsyncGenerator<ResearchEvent>>(async (resolve, reject) => {
      // Create a queue to hold events that arrive while yielding
      const eventQueue: ResearchEvent[] = [];
      let isComplete = false;
      
      // Set up the listener for the document
      const unsubscribe: Unsubscribe = onSnapshot(
        researchDocRef,
        (docSnapshot: DocumentSnapshot) => {
          if (!docSnapshot.exists()) {
            console.log("Research document does not exist yet");
            return;
          }
          
          const data = docSnapshot.data();
          if (!data) return;
          
          // Check for phase results in the document
          const phaseResults = data.phaseResults;
          if (phaseResults) {
            // Get the current phase from the document
            const currentPhase = data.currentPhase;
            if (currentPhase && phaseResults[currentPhase]) {
              const phaseResult = phaseResults[currentPhase] as PhaseResult;
              
              // Process the phase result through the store
              const processedEvent = store.processPhaseResult(sessionId, phaseResult);
              
              // Add to queue
              eventQueue.push(processedEvent);
              
              // Check if this is the final phase
              if (phaseResult.isFinalOutput || phaseResult.isProcessComplete) {
                isComplete = true;
              }
            }
          }
        },
        (error: Error) => {
          console.error('Error listening to research document:', error);
          reject(error);
        }
      );
      
      // Create and return the generator
      const generator = (async function*() {
        try {
          // Keep yielding events until there are no more and isComplete is true
          while (true) {
            // Yield any events in the queue
            while (eventQueue.length > 0) {
              yield eventQueue.shift()!;
            }
            
            // If we're done and queue is empty, exit the loop
            if (isComplete && eventQueue.length === 0) {
              break;
            }
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } finally {
          // Clean up the listener when the generator is done
          unsubscribe();
        }
      })();
      
      resolve(generator);
    });
  }
} 