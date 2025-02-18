import { StateCreator } from 'zustand';
import { Position } from '@/features/graph-map/types/graph';
import { LayoutState, LayoutActions, GraphStore } from './types';
import { createBoundaryManager } from '@/shared/services/boundary-manager';

const boundaryManager = createBoundaryManager();

export const createLayoutSlice: StateCreator<
  GraphStore,
  [],
  [],
  LayoutState & LayoutActions
> = (set, get) => ({
  nodePositions: new Map(),
  boundaryCircles: new Map(),
  
  isNodeWithinBoundary: (nodeId: string, newPosition: Position) => {
    const state = get();
    const containingBoundary = boundaryManager.findContainingBoundary(
      nodeId,
      state.boundaryCircles
    );
    
    if (!containingBoundary) return true;
    
    return boundaryManager.isPositionWithinBoundary(
      newPosition,
      containingBoundary
    );
  },
}); 