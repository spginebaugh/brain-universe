import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';
import { createGeometryService } from './geometry';
import { StandardsData } from '@/features/graph-map/types/standard';

export interface BoundaryParams {
  nodeId: string;
  childNodeIds: string[];
  position: Position;
  standards: StandardsData['data']['standards'];
  existingBoundaries: Map<string, BoundaryCircle>;
}

export interface BoundaryConstraints {
  min: number;
  max: number;
  base: number;
}

export interface BoundaryVisibilityParams {
  zoom: number;
  threshold: number;
}

export const createBoundaryManager = () => {
  const geometryService = createGeometryService();

  const calculateBoundaryRadius = (
    nodeIds: string[],
    standards: StandardsData['data']['standards']
  ): number => {
    // Group nodes by depth
    const nodesByDepth = new Map<number, string[]>();
    nodeIds.forEach(id => {
      const node = standards[id];
      if (node) {
        const depthNodes = nodesByDepth.get(node.depth) || [];
        depthNodes.push(id);
        nodesByDepth.set(node.depth, depthNodes);
      }
    });

    // Calculate boundary radius based on depth levels
    const BASE_RADIUS = 500;
    const RADIUS_INCREMENT = 500;
    const maxDepth = Math.max(...Array.from(nodesByDepth.keys()));
    const maxRadius = BASE_RADIUS + (maxDepth - 2) * RADIUS_INCREMENT;
    
    return maxRadius * 1.6; // Add some padding
  };

  const createBoundary = ({
    nodeId,
    childNodeIds,
    position,
    standards,
    existingBoundaries,
  }: BoundaryParams): BoundaryCircle => {
    const radius = calculateBoundaryRadius([nodeId, ...childNodeIds], standards);
    const adjustedPosition = geometryService.findNonOverlappingPosition(
      position,
      radius,
      Array.from(existingBoundaries.values())
    );

    return {
      id: nodeId,
      centerX: adjustedPosition.x,
      centerY: adjustedPosition.y,
      radius,
      nodeIds: [nodeId, ...childNodeIds],
    };
  };

  const isInRegionDragMode = ({ zoom, threshold }: BoundaryVisibilityParams): boolean => {
    return zoom <= threshold;
  };

  const findContainingBoundary = (
    nodeId: string,
    boundaries: Map<string, BoundaryCircle>
  ): BoundaryCircle | undefined => {
    return Array.from(boundaries.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );
  };

  const isPositionWithinBoundary = (
    position: Position,
    boundary: BoundaryCircle
  ): boolean => {
    return geometryService.isPointInCircle(
      position,
      boundary
    );
  };

  const updateBoundaryPosition = (
    boundary: BoundaryCircle,
    deltaX: number,
    deltaY: number
  ): BoundaryCircle => {
    return {
      ...boundary,
      centerX: boundary.centerX + deltaX,
      centerY: boundary.centerY + deltaY,
    };
  };

  const mergeBoundaries = (
    boundaries: BoundaryCircle[]
  ): BoundaryCircle => {
    const mergedCircle = geometryService.calculateEnclosingCircle(boundaries);
    
    // Combine all nodeIds
    const nodeIds = Array.from(new Set(
      boundaries.flatMap(b => b.nodeIds)
    ));

    return {
      id: `merged-${boundaries[0].id}`,
      ...mergedCircle,
      nodeIds,
    };
  };

  const splitBoundary = (
    boundary: BoundaryCircle,
    nodeGroups: string[][]
  ): BoundaryCircle[] => {
    return nodeGroups.map(group => {
      const positions = geometryService.calculateCircularPositions(
        { x: boundary.centerX, y: boundary.centerY },
        boundary.radius * 0.5,
        group.length
      );

      const center = geometryService.findCircleCenter(positions);
      const radius = boundary.radius / Math.sqrt(nodeGroups.length);

      return {
        id: `split-${boundary.id}-${group[0]}`,
        centerX: center.x,
        centerY: center.y,
        radius,
        nodeIds: group,
      };
    });
  };

  return {
    createBoundary,
    isInRegionDragMode,
    findContainingBoundary,
    isPositionWithinBoundary,
    updateBoundaryPosition,
    mergeBoundaries,
    splitBoundary,
  };
};

export type BoundaryManager = ReturnType<typeof createBoundaryManager>; 