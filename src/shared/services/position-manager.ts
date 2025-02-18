import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';
import { createGeometryService } from './geometry';

export interface NodePositionParams {
  nodeId: string;
  position: Position;
  boundaryCircles: Map<string, BoundaryCircle>;
  nodePositions: Map<string, Position>;
}

export interface RegionUpdateParams extends NodePositionParams {
  oldPosition: Position;
}

export interface CircularLayoutParams {
  centerPosition: Position;
  radius: number;
  nodeIds: string[];
}

export interface NonOverlappingPositionParams {
  targetPosition: Position;
  targetRadius: number;
  existingCircles: BoundaryCircle[];
}

export const createPositionManager = () => {
  const geometryService = createGeometryService();

  const isNodeWithinBoundary = ({
    nodeId,
    position,
    boundaryCircles,
  }: NodePositionParams): boolean => {
    // Find which boundary circle contains this node
    const containingCircle = Array.from(boundaryCircles.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );

    if (!containingCircle) return true; // If node isn't in any boundary, allow movement

    return geometryService.isPointInCircle(position, containingCircle);
  };

  const updateRegionPositions = ({
    nodeId,
    position,
    oldPosition,
    boundaryCircles,
    nodePositions,
  }: RegionUpdateParams): Map<string, Position> => {
    const updatedPositions = new Map(nodePositions);
    const region = Array.from(boundaryCircles.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );

    if (region) {
      const deltaX = position.x - oldPosition.x;
      const deltaY = position.y - oldPosition.y;

      // Update all nodes in this region
      region.nodeIds.forEach(id => {
        const nodePos = nodePositions.get(id);
        if (nodePos) {
          updatedPositions.set(id, {
            x: nodePos.x + deltaX,
            y: nodePos.y + deltaY,
          });
        }
      });
    } else {
      // Single node update
      updatedPositions.set(nodeId, position);
    }

    return updatedPositions;
  };

  const updateRegionBoundaries = ({
    nodeId,
    oldPosition,
    position,
    boundaryCircles,
  }: RegionUpdateParams): Map<string, BoundaryCircle> => {
    const updatedBoundaries = new Map(boundaryCircles);
    const region = Array.from(boundaryCircles.values()).find(
      circle => circle.nodeIds.includes(nodeId)
    );

    if (region) {
      const deltaX = position.x - oldPosition.x;
      const deltaY = position.y - oldPosition.y;

      const updatedRegion = {
        ...region,
        centerX: region.centerX + deltaX,
        centerY: region.centerY + deltaY,
      };

      updatedBoundaries.set(region.id, updatedRegion);
    }

    return updatedBoundaries;
  };

  const calculateCircularLayout = ({
    centerPosition,
    radius,
    nodeIds,
  }: CircularLayoutParams): Map<string, Position> => {
    const positions = new Map<string, Position>();
    const circularPositions = geometryService.calculateCircularPositions(
      centerPosition,
      radius,
      nodeIds.length
    );

    nodeIds.forEach((id, index) => {
      positions.set(id, circularPositions[index]);
    });

    return positions;
  };

  const findNonOverlappingPosition = ({
    targetPosition,
    targetRadius,
    existingCircles,
  }: NonOverlappingPositionParams): Position => {
    return geometryService.findNonOverlappingPosition(
      targetPosition,
      targetRadius,
      existingCircles
    );
  };

  return {
    isNodeWithinBoundary,
    updateRegionPositions,
    updateRegionBoundaries,
    calculateCircularLayout,
    findNonOverlappingPosition,
  };
};

export type PositionManager = ReturnType<typeof createPositionManager>; 