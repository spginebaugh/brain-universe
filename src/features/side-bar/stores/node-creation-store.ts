import { create } from 'zustand';

interface NodeCreationState {
  isCreationMode: boolean;
  selectedParentGraphId: string | null;
  setCreationMode: (isCreating: boolean) => void;
  setSelectedParentGraphId: (graphId: string | null) => void;
  reset: () => void;
}

export const useNodeCreationStore = create<NodeCreationState>((set) => ({
  isCreationMode: false,
  selectedParentGraphId: null,
  setCreationMode: (isCreating: boolean) => 
    set({ isCreationMode: isCreating }),
  setSelectedParentGraphId: (graphId: string | null) =>
    set({ selectedParentGraphId: graphId }),
  reset: () => 
    set({ isCreationMode: false, selectedParentGraphId: null })
})); 