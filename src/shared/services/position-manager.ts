import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';
import { createCoordinateTransform } from './coordinate-transform';

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
  const transformService = createCoordinateTransform();

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

    return transformService.getDistance(
      position,
      { x: containingCircle.centerX, y: containingCircle.centerY }
    ) <= containingCircle.radius;
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
    const totalNodes = nodeIds.length;

    nodeIds.forEach((id, index) => {
      const angle = (360 / totalNodes) * index;
      const position = transformService.polarToCartesian({
        centerX: centerPosition.x,
        centerY: centerPosition.y,
        radius,
        angleInDegrees: angle,
      });
      positions.set(id, position);
    });

    return positions;
  };

  const findNonOverlappingPosition = ({
    targetPosition,
    targetRadius,
    existingCircles,
  }: NonOverlappingPositionParams): Position => {
    if (existingCircles.length === 0) return targetPosition;

    // Check if current position overlaps
    const hasOverlap = existingCircles.some(circle => {
      const distance = transformService.getDistance(
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
      for (let angleStep = 0; angleStep < ANGLE_STEPS; angleStep++) {
        const angle = (2 * Math.PI * angleStep) / ANGLE_STEPS;
        const minRequiredDistance = targetRadius + circle.radius;
        
        for (let distanceStep = 1; distanceStep <= DISTANCE_STEPS; distanceStep++) {
          const distance = minRequiredDistance * (1 + distanceStep * 0.1);
          const candidatePosition = transformService.polarToCartesian({
            centerX: circle.centerX,
            centerY: circle.centerY,
            radius: distance,
            angleInDegrees: (angle * 180) / Math.PI,
          });

          const hasAnyOverlap = existingCircles.some(otherCircle => {
            const distToOther = transformService.getDistance(
              candidatePosition,
              { x: otherCircle.centerX, y: otherCircle.centerY }
            );
            return distToOther < (targetRadius + otherCircle.radius);
          });

          if (!hasAnyOverlap) {
            const distanceToTarget = transformService.getDistance(
              candidatePosition,
              targetPosition
            );
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

  return {
    isNodeWithinBoundary,
    updateRegionPositions,
    updateRegionBoundaries,
    calculateCircularLayout,
    findNonOverlappingPosition,
  };
};

export type PositionManager = ReturnType<typeof createPositionManager>; 