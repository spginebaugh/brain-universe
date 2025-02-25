import { create } from 'zustand';
import { ResearchState } from '../types/research';

interface DeepResearchRoadmapState {
  // Research state
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  researchState: ResearchState | null;
  progress: number;
  
  // UI state
  currentPhaseLabel: string;
  processingNode: string | null;
  cancelRequested: boolean;
  
  // Node generation tracking
  generatedNodeIds: Record<string, string>; // Maps chapterTitle -> nodeId
  generatedSubtopicIds: Record<string, Record<string, string>>; // Maps chapterTitle -> subtopicTitle -> nodeId
  
  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSessionId: (sessionId: string | null) => void;
  setResearchState: (state: ResearchState | null) => void;
  setProgress: (progress: number) => void;
  setCurrentPhaseLabel: (label: string) => void;
  setProcessingNode: (nodeId: string | null) => void;
  requestCancel: () => void;
  resetCancelRequest: () => void;
  addGeneratedNodeId: (chapterTitle: string, nodeId: string) => void;
  addGeneratedSubtopicId: (chapterTitle: string, subtopicTitle: string, nodeId: string) => void;
  reset: () => void;
}

const initialState = {
  isLoading: false,
  error: null,
  sessionId: null,
  researchState: null,
  progress: 0,
  currentPhaseLabel: 'Initializing',
  processingNode: null,
  cancelRequested: false,
  generatedNodeIds: {},
  generatedSubtopicIds: {},
};

export const useDeepResearchRoadmapStore = create<DeepResearchRoadmapState>((set) => ({
  ...initialState,
  
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSessionId: (sessionId) => set({ sessionId }),
  setResearchState: (researchState) => set({ researchState }),
  setProgress: (progress) => set({ progress }),
  setCurrentPhaseLabel: (currentPhaseLabel) => set({ currentPhaseLabel }),
  setProcessingNode: (processingNode) => set({ processingNode }),
  requestCancel: () => set({ cancelRequested: true }),
  resetCancelRequest: () => set({ cancelRequested: false }),
  
  addGeneratedNodeId: (chapterTitle, nodeId) => 
    set((state) => ({
      generatedNodeIds: {
        ...state.generatedNodeIds,
        [chapterTitle]: nodeId
      }
    })),
    
  addGeneratedSubtopicId: (chapterTitle, subtopicTitle, nodeId) =>
    set((state) => {
      const chapterSubtopics = state.generatedSubtopicIds[chapterTitle] || {};
      return {
        generatedSubtopicIds: {
          ...state.generatedSubtopicIds,
          [chapterTitle]: {
            ...chapterSubtopics,
            [subtopicTitle]: nodeId
          }
        }
      };
    }),
    
  reset: () => set(initialState)
})); 