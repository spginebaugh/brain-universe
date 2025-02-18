import { Position } from '@/features/graph-map/types/graph';

// Branded types for type safety
export type ScreenCoordinate = Position & { readonly __brand: unique symbol };
export type FlowCoordinate = Position & { readonly __brand: unique symbol };
export type LocalCoordinate = Position & { readonly __brand: unique symbol };

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

export const createCoordinateTransform = () => {
  const screenToFlow = (
    position: Position,
    context: TransformContext
  ): Position => {
    return {
      x: (position.x - (context.viewport.x || 0)) / context.zoom,
      y: (position.y - (context.viewport.y || 0)) / context.zoom,
    };
  };

  const flowToScreen = (
    position: Position,
    context: TransformContext
  ): Position => {
    return {
      x: position.x * context.zoom + (context.viewport.x || 0),
      y: position.y * context.zoom + (context.viewport.y || 0),
    };
  };

  const polarToCartesian = ({
    centerX,
    centerY,
    radius,
    angleInDegrees,
  }: PolarCoordinates): Position => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const cartesianToPolar = (
    position: Position,
    center: Position
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

  const applyViewportTransform = (
    position: Position,
    context: TransformContext
  ): Position => {
    return {
      x: position.x * context.zoom + context.viewport.x,
      y: position.y * context.zoom + context.viewport.y,
    };
  };

  const getDistance = (p1: Position, p2: Position): number => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const scalePosition = (
    position: Position,
    scale: number,
    origin: Position = { x: 0, y: 0 }
  ): Position => {
    return {
      x: origin.x + (position.x - origin.x) * scale,
      y: origin.y + (position.y - origin.y) * scale,
    };
  };

  const constrainScale = (
    scale: number,
    { min, max, base }: ScaleConstraints
  ): number => {
    return Math.min(max, Math.max(min, base / scale));
  };

  const getInverseScaleWithConstraints = (
    zoom: number,
    constraints: ScaleConstraints
  ): number => {
    return constrainScale(zoom, constraints);
  };

  return {
    screenToFlow,
    flowToScreen,
    polarToCartesian,
    cartesianToPolar,
    applyViewportTransform,
    getDistance,
    scalePosition,
    constrainScale,
    getInverseScaleWithConstraints,
  };
};

export type CoordinateTransform = ReturnType<typeof createCoordinateTransform>; 