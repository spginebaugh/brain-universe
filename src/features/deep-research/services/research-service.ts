import { v4 as uuidv4 } from 'uuid';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, onSnapshot, Unsubscribe, CollectionReference, QuerySnapshot, DocumentChange } from 'firebase/firestore';
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
      const researchEventsCollection = collection(
        db, 
        'users', 
        userId, 
        'researchSessions', 
        sessionId, 
        'events'
      ) as CollectionReference<ResearchEvent>;
      
      // Use a Promise to control the generator flow
      yield* this.setupFirestoreListener(researchEventsCollection, sessionId);
      
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
   * Sets up a listener for Firestore events and yields them as they arrive
   */
  private async *setupFirestoreListener(
    eventsCollection: CollectionReference<ResearchEvent>, 
    sessionId: string
  ): AsyncGenerator<ResearchEvent> {
    const store = useResearchStore.getState();
    
    // Create a promise that will resolve when the first event is received
    // or reject after a timeout
    return new Promise<AsyncGenerator<ResearchEvent>>(async (resolve, reject) => {
      // Create a queue to hold events that arrive while yielding
      const eventQueue: ResearchEvent[] = [];
      let isComplete = false;
      
      // Set up the listener
      const unsubscribe: Unsubscribe = onSnapshot(
        eventsCollection,
        (snapshot: QuerySnapshot<ResearchEvent>) => {
          snapshot.docChanges().forEach((change: DocumentChange<ResearchEvent>) => {
            if (change.type === 'added') {
              const event = change.doc.data();
              
              // Process the event through the store
              // For Firebase events, we need to handle them differently 
              // since they may not have the exact same structure as PhaseResult
              if ('phase' in event) {
                const processedEvent = store.processPhaseResult(sessionId, event as unknown as PhaseResult);
                
                // Add to queue
                eventQueue.push(processedEvent);
                
                // Check if this is the final event
                if (event.isFinalOutput || event.isProcessComplete) {
                  isComplete = true;
                }
              }
            }
          });
        },
        (error: Error) => {
          console.error('Error listening to research events:', error);
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