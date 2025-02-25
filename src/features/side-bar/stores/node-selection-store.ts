import { create } from 'zustand';
import { Node } from '@xyflow/react';
import { FlowNodeData } from '@/features/graph-workspace/types/workspace-types';

interface NodeSelectionState {
  selectedNodes: Node<FlowNodeData>[];
  setSelectedNodes: (nodes: Node<FlowNodeData>[]) => void;
  clearSelectedNodes: () => void;
  isMultiEditMode: boolean;
  setMultiEditMode: (isActive: boolean) => void;
}

export const useNodeSelectionStore = create<NodeSelectionState>((set) => ({
  selectedNodes: [],
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes }),
  clearSelectedNodes: () => set({ selectedNodes: [] }),
  isMultiEditMode: false,
  setMultiEditMode: (isActive) => set({ isMultiEditMode: isActive }),
})); 