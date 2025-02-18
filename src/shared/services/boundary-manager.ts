import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';
import { createCoordinateTransform } from './coordinate-transform';
import { createPositionManager } from './position-manager';
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
  const transformService = createCoordinateTransform();
  const positionManager = createPositionManager();

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
    const adjustedPosition = positionManager.findNonOverlappingPosition({
      targetPosition: position,
      targetRadius: radius,
      existingCircles: Array.from(existingBoundaries.values()),
    });

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
    return transformService.getDistance(
      position,
      { x: boundary.centerX, y: boundary.centerY }
    ) <= boundary.radius;
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
    // Calculate the encompassing circle for multiple boundaries
    const positions = boundaries.map(b => ({ x: b.centerX, y: b.centerY }));
    const radii = boundaries.map(b => b.radius);
    
    // Find the center point that minimizes the distance to all boundaries
    const centerX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
    const centerY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    
    // Calculate the radius that encompasses all boundaries
    const radius = Math.max(
      ...boundaries.map((b, i) => 
        transformService.getDistance({ x: centerX, y: centerY }, positions[i]) + radii[i]
      )
    );

    // Combine all nodeIds
    const nodeIds = Array.from(new Set(
      boundaries.flatMap(b => b.nodeIds)
    ));

    return {
      id: `merged-${boundaries[0].id}`,
      centerX,
      centerY,
      radius,
      nodeIds,
    };
  };

  const splitBoundary = (
    boundary: BoundaryCircle,
    nodeGroups: string[][]
  ): BoundaryCircle[] => {
    return nodeGroups.map(group => {
      const groupPositions = group.map(id => {
        const index = boundary.nodeIds.indexOf(id);
        const angle = (2 * Math.PI * index) / boundary.nodeIds.length;
        return transformService.polarToCartesian({
          centerX: boundary.centerX,
          centerY: boundary.centerY,
          radius: boundary.radius * 0.5, // Place new boundaries closer to center
          angleInDegrees: (angle * 180) / Math.PI,
        });
      });

      // Calculate center and radius for the new boundary
      const centerX = groupPositions.reduce((sum, pos) => sum + pos.x, 0) / group.length;
      const centerY = groupPositions.reduce((sum, pos) => sum + pos.y, 0) / group.length;
      const radius = boundary.radius / Math.sqrt(nodeGroups.length); // Scale radius based on split count

      return {
        id: `split-${boundary.id}-${group[0]}`,
        centerX,
        centerY,
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