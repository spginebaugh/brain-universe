import { StateCreator } from 'zustand';
import type { StandardsData } from '@/features/graph-map/types/standard';
import { NodeState, NodeActions, GraphStore } from './types';
import { 
  findNonOverlappingPosition, 
  calculateCircularLayout 
} from '@/features/graph-map/utils/graph-math';
import { Position } from '@/features/graph-map/types/graph';

const groupNodesByDepth = (
  nodeIds: string[],
  standards: StandardsData['data']['standards']
) => {
  const nodesByDepth = new Map<number, string[]>();
  
  nodeIds.forEach(id => {
    const node = standards[id];
    if (node) {
      const depthNodes = nodesByDepth.get(node.depth) || [];
      depthNodes.push(id);
      nodesByDepth.set(node.depth, depthNodes);
    }
  });
  
  return nodesByDepth;
};

export const createNodeSlice: StateCreator<
  GraphStore,
  [],
  [],
  NodeState & NodeActions
> = (set) => ({
  activeRootNodes: new Set(),
  visibleNodes: new Set(),
  
  addRootNode: (nodeId, childNodeIds, position, standards) => 
    set((state) => {
      const newActiveRootNodes = new Set(state.activeRootNodes);
      newActiveRootNodes.add(nodeId);
      
      const newVisibleNodes = new Set(state.visibleNodes);
      newVisibleNodes.add(nodeId);
      childNodeIds.forEach(id => newVisibleNodes.add(id));
      
      // Group child nodes by depth
      const nodesByDepth = groupNodesByDepth([...childNodeIds], standards);
      
      // Calculate boundary radius
      const BASE_RADIUS = 500;
      const RADIUS_INCREMENT = 500;
      const maxRadius = BASE_RADIUS + (Math.max(...Array.from(nodesByDepth.keys())) - 2) * RADIUS_INCREMENT;
      const boundaryRadius = maxRadius * 1.6;

      // Find non-overlapping position
      const adjustedPosition = findNonOverlappingPosition({
        targetPosition: position,
        targetRadius: boundaryRadius,
        existingCircles: Array.from(state.boundaryCircles.values())
      });
      
      const newNodePositions = new Map(state.nodePositions);
      // Place the root node at the adjusted position
      newNodePositions.set(nodeId, adjustedPosition);
      
      // Position nodes at each depth level with adjusted center
      nodesByDepth.forEach((nodesAtDepth, depth) => {
        const radius = BASE_RADIUS + (depth - 2) * RADIUS_INCREMENT;
        const circularPositions = calculateCircularLayout({
          centerPosition: adjustedPosition,
          radius,
          nodeIds: nodesAtDepth
        });
        
        // Merge the new positions into the map
        circularPositions.forEach((pos: Position, id: string) => {
          newNodePositions.set(id, pos);
        });
      });
      
      // Create boundary circle at adjusted position
      const newBoundaryCircles = new Map(state.boundaryCircles);
      newBoundaryCircles.set(nodeId, {
        id: nodeId,
        centerX: adjustedPosition.x,
        centerY: adjustedPosition.y,
        radius: boundaryRadius,
        nodeIds: [nodeId, ...childNodeIds]
      });
      
      return {
        activeRootNodes: newActiveRootNodes,
        visibleNodes: newVisibleNodes,
        nodePositions: newNodePositions,
        boundaryCircles: newBoundaryCircles,
      };
    }),
}); 