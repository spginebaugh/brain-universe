export interface Position {
  x: number;
  y: number;
}

export interface BoundaryCircle {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
  nodeIds: string[];
} 