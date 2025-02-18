import { Position, BoundaryCircle } from '../types/graph';
import { createCoordinateTransform } from '@/shared/services/coordinate-transform';

const transformService = createCoordinateTransform();

/**
 * Converts polar coordinates to cartesian coordinates
 */
export const polarToCartesian = ({
  centerX,
  centerY,
  radius,
  angleInDegrees,
}: {
  centerX: number;
  centerY: number;
  radius: number;
  angleInDegrees: number;
}): Position => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

/**
 * Calculates the distance between two points
 */
export const getDistance = (p1: Position, p2: Position): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

/**
 * Checks if a position is within a boundary circle
 */
export const isPositionWithinBoundary = ({
  position,
  boundaryCircle,
}: {
  position: Position;
  boundaryCircle: BoundaryCircle;
}): boolean => {
  const distance = transformService.getDistance(
    position,
    { x: boundaryCircle.centerX, y: boundaryCircle.centerY }
  );
  return distance <= boundaryCircle.radius;
};

/**
 * Finds a non-overlapping position for a new boundary circle
 */
export const findNonOverlappingPosition = ({
  targetPosition,
  targetRadius,
  existingCircles,
}: {
  targetPosition: Position;
  targetRadius: number;
  existingCircles: BoundaryCircle[];
}): Position => {
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
    // Try positions around each existing circle
    for (let angleStep = 0; angleStep < ANGLE_STEPS; angleStep++) {
      const angle = (2 * Math.PI * angleStep) / ANGLE_STEPS;
      const minRequiredDistance = targetRadius + circle.radius;
      
      for (let distanceStep = 1; distanceStep <= DISTANCE_STEPS; distanceStep++) {
        const distance = minRequiredDistance * (1 + distanceStep * 0.1); // Add 10% increment each step
        const candidatePosition = transformService.polarToCartesian({
          centerX: circle.centerX,
          centerY: circle.centerY,
          radius: distance,
          angleInDegrees: (angle * 180) / Math.PI,
        });

        // Check if this position overlaps with any circle
        const hasAnyOverlap = existingCircles.some(otherCircle => {
          const distToOther = transformService.getDistance(
            candidatePosition,
            { x: otherCircle.centerX, y: otherCircle.centerY }
          );
          return distToOther < (targetRadius + otherCircle.radius);
        });

        if (!hasAnyOverlap) {
          const distanceToTarget = transformService.getDistance(candidatePosition, targetPosition);
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

/**
 * Calculates positions for nodes in a circular layout
 */
export const calculateCircularLayout = ({
  centerPosition,
  radius,
  nodeIds,
}: {
  centerPosition: Position;
  radius: number;
  nodeIds: string[];
}): Map<string, Position> => {
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