import { StateCreator } from 'zustand';
import { Position } from '@/features/graph-map/types/graph';
import { LayoutState, LayoutActions, GraphStore } from './types';
import { isPositionWithinBoundary } from '@/features/graph-map/utils/graph-math';

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
    const boundaryCircle = Array.from(state.boundaryCircles.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );
    
    if (!boundaryCircle) return true;
    
    return isPositionWithinBoundary({
      position: newPosition,
      boundaryCircle
    });
  },
}); 