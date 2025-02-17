import { Position, BoundaryCircle } from '../types/graph';
import { isPositionWithinBoundary } from './graph-math';

interface BoundaryUpdate {
  nodeId: string;
  position: Position;
  boundaryCircles: Map<string, BoundaryCircle>;
  nodePositions: Map<string, Position>;
}

interface RegionMovement {
  nodeId: string;
  oldPosition: Position;
  newPosition: Position;
  boundaryCircles: Map<string, BoundaryCircle>;
  nodePositions: Map<string, Position>;
}

/**
 * Checks if a node's new position is within its boundary constraints
 */
export const isNodeWithinBoundaryConstraints = ({
  nodeId,
  position,
  boundaryCircles,
}: {
  nodeId: string;
  position: Position;
  boundaryCircles: Map<string, BoundaryCircle>;
}): boolean => {
  // Find which boundary circle contains this node
  const containingCircle = Array.from(boundaryCircles.values()).find(
    circle => circle.nodeIds.includes(nodeId)
  );

  if (!containingCircle) return true; // If node isn't in any boundary, allow movement

  return isPositionWithinBoundary({
    position,
    boundaryCircle: containingCircle,
  });
};

/**
 * Updates node positions within a boundary/region
 */
export const updateBoundaryNodePositions = ({
  nodeId,
  position,
  boundaryCircles,
  nodePositions,
}: BoundaryUpdate): Map<string, Position> => {
  const updatedPositions = new Map(nodePositions);
  const region = Array.from(boundaryCircles.values()).find(
    circle => circle.nodeIds.includes(nodeId)
  );

  if (region) {
    const oldPosition = nodePositions.get(nodeId);
    if (oldPosition) {
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
    }
  } else {
    // Single node update
    updatedPositions.set(nodeId, position);
  }

  return updatedPositions;
};

/**
 * Updates boundary circle positions when a region is moved
 */
export const updateBoundaryCirclePositions = ({
  nodeId,
  oldPosition,
  newPosition,
  boundaryCircles,
}: RegionMovement): Map<string, BoundaryCircle> => {
  const updatedBoundaries = new Map(boundaryCircles);
  const region = Array.from(boundaryCircles.values()).find(
    circle => circle.nodeIds.includes(nodeId)
  );

  if (region) {
    const deltaX = newPosition.x - oldPosition.x;
    const deltaY = newPosition.y - oldPosition.y;

    const updatedRegion = {
      ...region,
      centerX: region.centerX + deltaX,
      centerY: region.centerY + deltaY,
    };

    updatedBoundaries.set(region.id, updatedRegion);
  }

  return updatedBoundaries;
};

/**
 * Determines if the graph is in region drag mode based on zoom level
 */
export const isInRegionDragMode = (zoom: number): boolean => {
  const BOUNDARY_TEXT_VISIBILITY_THRESHOLD = 0.3;
  return zoom <= BOUNDARY_TEXT_VISIBILITY_THRESHOLD;
}; 