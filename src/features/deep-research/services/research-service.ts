import { v4 as uuidv4 } from 'uuid';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, setDoc, onSnapshot, Unsubscribe, DocumentSnapshot } from 'firebase/firestore';
import { useAuthStore } from '@/features/auth/stores/auth-store';

// Simplified types
export interface ResearchRequest {
  query: string;
  numberOfChapters?: number;
  sessionId?: string;
}

export interface ResearchResponse {
  success: boolean;
  sessionId: string;
  error?: string;
}

export type ResearchStatus = 'idle' | 'running' | 'completed' | 'error';

export interface ResearchSessionData {
  id: string;
  userId: string;
  query: string;
  numberOfChapters: number;
  status: ResearchStatus;
  currentPhase?: string;
  progress?: {
    totalChapters: number;
    completedChapters: number;
  };
  chapters?: any[];
  error?: string;
}

export interface ResearchProgressCallback {
  (data: ResearchSessionData): void;
}

export class ResearchService {
  private unsubscribe: Unsubscribe | null = null;
  
  /**
   * Starts a research process by calling the Firebase cloud function
   * and returns the session ID
   */
  async startResearch(request: ResearchRequest): Promise<string> {
    const userId = useAuthStore.getState().user?.uid;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const sessionId = request.sessionId || uuidv4();
    
    try {
      // Create a document in Firestore first to track progress
      // Using a unique session ID that we can track
      const db = getFirestore();
      await setDoc(doc(db, 'users', userId, 'research', sessionId), {
        id: sessionId,
        userId,
        query: request.query,
        numberOfChapters: request.numberOfChapters || 5,
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Call the Firebase function without waiting for its result
      // This avoids client timeout issues with long-running functions
      const functions = getFunctions();
      const runDeepResearch = httpsCallable<ResearchRequest, ResearchResponse>(
        functions, 
        'runDeepResearch'
      );
      
      // Start the function but don't await it
      // We'll use Firestore to track progress instead
      console.log('Starting research function with session:', sessionId);
      runDeepResearch({
        query: request.query,
        numberOfChapters: request.numberOfChapters,
        sessionId: sessionId // Pass the sessionId to the function
      }).catch(error => {
        // Even if we get a timeout error here, the function may still be running
        // We'll rely on Firestore for actual status
        console.warn('Function call returned with possible timeout:', error.message);
      });
      
      // Return the session ID immediately
      return sessionId;
    } catch (error) {
      console.error('Error starting research:', error);
      throw new Error('Failed to initiate research process');
    }
  }
  
  /**
   * Listen to research progress in Firestore
   */
  trackResearchProgress(
    sessionId: string, 
    onProgress: ResearchProgressCallback,
    onError: (error: Error) => void
  ): () => void {
    const userId = useAuthStore.getState().user?.uid;
    
    if (!userId) {
      onError(new Error('User not authenticated'));
      return () => {};
    }
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'research', sessionId);
    
    this.unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        if (!snapshot.exists()) {
          console.log("Research document does not exist yet");
          return;
        }
        
        const data = snapshot.data();
        if (!data) return;
        
        // Create simplified data object
        const sessionData: ResearchSessionData = {
          id: sessionId,
          userId,
          query: data.query,
          numberOfChapters: data.numberOfChapters || 0,
          status: data.status,
          currentPhase: data.currentPhase,
          progress: data.progress,
          chapters: data.state?.plannedChapters || data.state?.chapters ? 
            Object.values(data.state.chapters || {}) : []
        };
        
        // Call the progress callback
        onProgress(sessionData);
      },
      (error: Error) => {
        console.error('Error tracking research progress:', error);
        onError(error);
      }
    );
    
    // Return a function to stop listening
    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
  
  /**
   * Calculate progress percentage based on current phase and completed chapters
   */
  calculateProgressPercentage(data: ResearchSessionData): number {
    if (!data || data.status === 'idle') return 0;
    if (data.status === 'completed') return 100;
    if (data.status === 'error') return 0;
    
    // If we have progress data, use it
    if (data.progress && data.progress.totalChapters > 0) {
      const baseProgress = 20; // First 20% is planning
      const chapterProgress = 80; // Remaining 80% is chapter completion
      
      const completedChapters = data.progress.completedChapters || 0;
      const totalChapters = data.progress.totalChapters || 1;
      
      const chapterPercentage = completedChapters / totalChapters;
      return Math.min(100, baseProgress + (chapterPercentage * chapterProgress));
    }
    
    // If we only have phase information, use that
    switch (data.currentPhase) {
      case 'initial_research': return 10;
      case 'planning': return 20;
      case 'chapter_research': return 40;
      case 'chapter_writing': return 60;
      case 'complete': return 100;
      default: return 5;
    }
  }
  
  /**
   * Get a friendly label for the current research phase
   */
  getPhaseLabel(data: ResearchSessionData): string {
    if (!data) return 'Initializing...';
    
    if (data.status === 'completed') return 'Research complete';
    if (data.status === 'error') return `Error: ${data.error || 'Unknown error'}`;
    if (data.status === 'idle') return 'Ready to start';
    
    switch (data.currentPhase) {
      case 'initial_research': return 'Initial research';
      case 'planning': return 'Planning chapters';
      case 'chapter_research': return 'Researching chapters';
      case 'chapter_writing': return 'Writing chapters';
      case 'complete': return 'Research complete';
      default: return 'Processing...';
    }
  }
} 