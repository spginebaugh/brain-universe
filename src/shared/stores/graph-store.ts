import { create } from 'zustand';
import type { StandardsData } from '@/features/graph-map/types/standard';
import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';
import { 
  findNonOverlappingPosition, 
  calculateCircularLayout, 
  isPositionWithinBoundary 
} from '@/features/graph-map/utils/graph-math';

// Group nodes by their depth
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

interface GraphStore {
  activeRootNodes: Set<string>;
  visibleNodes: Set<string>;
  nodePositions: Map<string, Position>;
  boundaryCircles: Map<string, BoundaryCircle>;
  isMenuOpen: boolean;
  zoomLevel: number;
  placementMode: {
    active: boolean;
    nodeId: string | null;
  };
  addRootNode: (
    nodeId: string, 
    childNodeIds: string[], 
    position: Position,
    standards: StandardsData['data']['standards']
  ) => void;
  toggleMenu: (isOpen?: boolean) => void;
  enterPlacementMode: (nodeId: string) => void;
  exitPlacementMode: () => void;
  isNodeWithinBoundary: (nodeId: string, newPosition: Position) => boolean;
  setZoomLevel: (zoom: number) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  activeRootNodes: new Set(),
  visibleNodes: new Set(),
  nodePositions: new Map(),
  boundaryCircles: new Map(),
  isMenuOpen: false,
  zoomLevel: 1,
  placementMode: {
    active: false,
    nodeId: null,
  },
  addRootNode: (nodeId: string, childNodeIds: string[], position: Position, standards: StandardsData['data']['standards']) => 
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
        circularPositions.forEach((pos, id) => {
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
  toggleMenu: (isOpen?: boolean) =>
    set((state) => ({
      isMenuOpen: isOpen ?? !state.isMenuOpen,
    })),
  enterPlacementMode: (nodeId: string) =>
    set(() => ({
      placementMode: {
        active: true,
        nodeId,
      },
      isMenuOpen: false, // Close the menu when entering placement mode
    })),
  exitPlacementMode: () =>
    set(() => ({
      placementMode: {
        active: false,
        nodeId: null,
      },
    })),
  isNodeWithinBoundary: (nodeId: string, newPosition: Position) => {
    const state = get();
    // Find which boundary circle this node belongs to
    const boundaryCircle = Array.from(state.boundaryCircles.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );
    
    if (!boundaryCircle) return true; // If no boundary found, allow movement
    
    return isPositionWithinBoundary({
      position: newPosition,
      boundaryCircle
    });
  },
  setZoomLevel: (zoom: number) =>
    set(() => ({
      zoomLevel: zoom,
    })),
})); 