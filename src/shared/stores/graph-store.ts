import { create } from 'zustand';
import type { StandardsData } from '@/features/graph-map/types/standard';

interface Position {
  x: number;
  y: number;
}

interface BoundaryCircle {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
  nodeIds: string[];
}

// Helper function to convert polar to cartesian coordinates
const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): Position => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

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

// Helper function to calculate distance between two points
const getDistance = (p1: Position, p2: Position): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// Helper function to find closest non-overlapping position
const findNonOverlappingPosition = (
  targetPosition: Position,
  targetRadius: number,
  existingCircles: BoundaryCircle[]
): Position => {
  if (existingCircles.length === 0) return targetPosition;

  // Check if current position overlaps
  const hasOverlap = existingCircles.some(circle => {
    const distance = getDistance(
      targetPosition,
      { x: circle.centerX, y: circle.centerY }
    );
    return distance < (targetRadius + circle.radius);
  });

  if (!hasOverlap) return targetPosition;

  // Find the closest valid position
  const ANGLE_STEPS = 36; // Check every 10 degrees
  const DISTANCE_STEPS = 10; // Try 10 different distances
  let minDistance = Infinity;
  let bestPosition = targetPosition;

  existingCircles.forEach(circle => {
    // Try positions around each existing circle
    for (let angleStep = 0; angleStep < ANGLE_STEPS; angleStep++) {
      const angle = (2 * Math.PI * angleStep) / ANGLE_STEPS;
      const minRequiredDistance = targetRadius + circle.radius;
      
      for (let distanceStep = 1; distanceStep <= DISTANCE_STEPS; distanceStep++) {
        const distance = minRequiredDistance * (1 + distanceStep * 0.1); // Add 10% increment each step
        const candidatePosition = {
          x: circle.centerX + Math.cos(angle) * distance,
          y: circle.centerY + Math.sin(angle) * distance
        };

        // Check if this position overlaps with any circle
        const hasAnyOverlap = existingCircles.some(otherCircle => {
          const distToOther = getDistance(
            candidatePosition,
            { x: otherCircle.centerX, y: otherCircle.centerY }
          );
          return distToOther < (targetRadius + otherCircle.radius);
        });

        if (!hasAnyOverlap) {
          const distanceToTarget = getDistance(candidatePosition, targetPosition);
          if (distanceToTarget < minDistance) {
            minDistance = distanceToTarget;
            bestPosition = candidatePosition;
          }
        }
      }
    }
  });

  return bestPosition;
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
      const adjustedPosition = findNonOverlappingPosition(
        position,
        boundaryRadius,
        Array.from(state.boundaryCircles.values())
      );
      
      const newNodePositions = new Map(state.nodePositions);
      // Place the root node at the adjusted position
      newNodePositions.set(nodeId, adjustedPosition);
      
      // Position nodes at each depth level with adjusted center
      nodesByDepth.forEach((nodesAtDepth, depth) => {
        const radius = BASE_RADIUS + (depth - 2) * RADIUS_INCREMENT;
        const totalNodesAtDepth = nodesAtDepth.length;
        
        nodesAtDepth.forEach((id, index) => {
          const angle = (360 / totalNodesAtDepth) * index;
          const nodePosition = polarToCartesian(
            adjustedPosition.x,
            adjustedPosition.y,
            radius,
            angle
          );
          newNodePositions.set(id, nodePosition);
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
    
    // Calculate distance from new position to circle center
    const distance = Math.sqrt(
      Math.pow(newPosition.x - boundaryCircle.centerX, 2) + 
      Math.pow(newPosition.y - boundaryCircle.centerY, 2)
    );
    
    return distance <= boundaryCircle.radius;
  },
  setZoomLevel: (zoom: number) =>
    set(() => ({
      zoomLevel: zoom,
    })),
})); 