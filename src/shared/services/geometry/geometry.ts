import { Position } from '@/features/graph-map/types/graph';

export interface Circle {
  centerX: number;
  centerY: number;
  radius: number;
}

export interface Vector2D extends Position {
  x: number;
  y: number;
}

export interface PolarCoordinates {
  centerX: number;
  centerY: number;
  radius: number;
  angleInDegrees: number;
}

export interface TransformContext {
  zoom: number;
  viewport: {
    x: number;
    y: number;
  };
}

export interface ScaleConstraints {
  min: number;
  max: number;
  base: number;
}

export const createGeometryService = () => {
  const getDistance = (p1: Vector2D, p2: Vector2D): number => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const isPointInCircle = (point: Vector2D, circle: Circle): boolean => {
    return getDistance(point, { x: circle.centerX, y: circle.centerY }) <= circle.radius;
  };

  const doCirclesOverlap = (circle1: Circle, circle2: Circle): boolean => {
    const distance = getDistance(
      { x: circle1.centerX, y: circle1.centerY },
      { x: circle2.centerX, y: circle2.centerY }
    );
    return distance < (circle1.radius + circle2.radius);
  };

  const findCircleCenter = (points: Vector2D[]): Vector2D => {
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x: centerX, y: centerY };
  };

  const calculateEnclosingCircle = (circles: Circle[]): Circle => {
    const center = findCircleCenter(
      circles.map(c => ({ x: c.centerX, y: c.centerY }))
    );

    // Calculate radius that encompasses all circles
    const radius = Math.max(
      ...circles.map(c => 
        getDistance(center, { x: c.centerX, y: c.centerY }) + c.radius
      )
    );

    return {
      centerX: center.x,
      centerY: center.y,
      radius,
    };
  };

  const polarToCartesian = ({
    centerX,
    centerY,
    radius,
    angleInDegrees,
  }: PolarCoordinates): Vector2D => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const cartesianToPolar = (
    position: Vector2D,
    center: Vector2D
  ): PolarCoordinates => {
    const deltaX = position.x - center.x;
    const deltaY = position.y - center.y;
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    let angleInDegrees = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
    
    // Normalize angle to [0, 360)
    angleInDegrees = (angleInDegrees + 360) % 360;

    return {
      centerX: center.x,
      centerY: center.y,
      radius,
      angleInDegrees,
    };
  };

  const calculateCircularPositions = (
    center: Vector2D,
    radius: number,
    count: number,
    startAngle = 0
  ): Vector2D[] => {
    const positions: Vector2D[] = [];
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (360 / count) * i;
      positions.push(
        polarToCartesian({
          centerX: center.x,
          centerY: center.y,
          radius,
          angleInDegrees: angle,
        })
      );
    }
    return positions;
  };

  const findNonOverlappingPosition = (
    targetPosition: Vector2D,
    targetRadius: number,
    existingCircles: Circle[]
  ): Vector2D => {
    if (existingCircles.length === 0) return targetPosition;

    // Check if current position overlaps
    const hasOverlap = existingCircles.some(circle => 
      doCirclesOverlap(
        { centerX: targetPosition.x, centerY: targetPosition.y, radius: targetRadius },
        circle
      )
    );

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
          const candidatePosition = polarToCartesian({
            centerX: circle.centerX,
            centerY: circle.centerY,
            radius: distance,
            angleInDegrees: (angle * 180) / Math.PI,
          });

          const hasAnyOverlap = existingCircles.some(otherCircle =>
            doCirclesOverlap(
              { centerX: candidatePosition.x, centerY: candidatePosition.y, radius: targetRadius },
              otherCircle
            )
          );

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

  const screenToFlow = (
    position: Vector2D,
    context: TransformContext
  ): Vector2D => {
    return {
      x: (position.x - (context.viewport.x || 0)) / context.zoom,
      y: (position.y - (context.viewport.y || 0)) / context.zoom,
    };
  };

  const flowToScreen = (
    position: Vector2D,
    context: TransformContext
  ): Vector2D => {
    return {
      x: position.x * context.zoom + (context.viewport.x || 0),
      y: position.y * context.zoom + (context.viewport.y || 0),
    };
  };

  const applyViewportTransform = (
    position: Vector2D,
    context: TransformContext
  ): Vector2D => {
    return {
      x: position.x * context.zoom + context.viewport.x,
      y: position.y * context.zoom + context.viewport.y,
    };
  };

  const getInverseScaleWithConstraints = (
    scale: number,
    { min, max, base }: ScaleConstraints
  ): number => {
    return Math.min(max, Math.max(min, base / scale));
  };

  return {
    getDistance,
    isPointInCircle,
    doCirclesOverlap,
    findCircleCenter,
    calculateEnclosingCircle,
    polarToCartesian,
    cartesianToPolar,
    calculateCircularPositions,
    findNonOverlappingPosition,
    screenToFlow,
    flowToScreen,
    applyViewportTransform,
    getInverseScaleWithConstraints,
  };
};

export type GeometryService = ReturnType<typeof createGeometryService>; 