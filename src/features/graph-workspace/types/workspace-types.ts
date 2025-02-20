import type { Graph } from '@/shared/types/graph';
import type { Node } from '@/shared/types/node';
import type { Edge } from '@/shared/types/edge';

// Position in the actual workspace
export interface WorkspacePosition {
  x: number;
  y: number;
}

// Flow-specific position that includes zoom and viewport information
export interface FlowPosition extends WorkspacePosition {
  zoom?: number;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// Flow-specific node type for visualization
export interface FlowNode extends Node {
  // Additional ReactFlow specific properties
  id: string;
  type: string;
  displayPosition: WorkspacePosition;
}

// Flow-specific edge type for visualization
export interface FlowEdge extends Edge {
  // Additional ReactFlow specific properties
  id: string;
  source: string;
  target: string;
}

// Flow-specific graph type for visualization
export interface FlowGraph extends Graph {
  // Additional ReactFlow specific properties
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Workspace state interface
export interface WorkspaceState {
  graph: FlowGraph | null;
  isLoading: boolean;
  error: Error | null;
} 