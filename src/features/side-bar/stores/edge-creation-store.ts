import { create } from 'zustand';

interface EdgeCreationState {
  isCreationMode: boolean;
  selectedFirstNodeId: string | null;
  selectedGraphId: string | null;
  setCreationMode: (isCreating: boolean) => void;
  setSelectedFirstNode: (nodeId: string, graphId: string) => void;
  resetSelection: () => void;
}

export const useEdgeCreationStore = create<EdgeCreationState>((set) => ({
  isCreationMode: false,
  selectedFirstNodeId: null,
  selectedGraphId: null,
  setCreationMode: (isCreating: boolean) => 
    set({ isCreationMode: isCreating }),
  setSelectedFirstNode: (nodeId: string, graphId: string) => 
    set({ selectedFirstNodeId: nodeId, selectedGraphId: graphId }),
  resetSelection: () => 
    set({ selectedFirstNodeId: null, selectedGraphId: null, isCreationMode: false }),
})); 