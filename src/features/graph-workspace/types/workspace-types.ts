import type { Graph } from '@/shared/types/graph';
import type { Node as BaseNode } from '@/shared/types/node';
import type { Edge as BaseEdge } from '@/shared/types/edge';
import type { Node as ReactFlowNode, Edge as ReactFlowEdge, XYPosition, Viewport } from '@xyflow/react';

// Position in the actual workspace (matches ReactFlow's XYPosition)
export type WorkspacePosition = XYPosition;

// Flow-specific position that includes viewport information
export interface FlowPosition extends XYPosition {
  viewport?: Viewport;
}

// Node data specific to our application
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  status: string;
  graphId: string;
  graphName: string;
  // Include base node properties in the data
  properties: BaseNode['properties'];
  metadata: BaseNode['metadata'];
  progress?: BaseNode['progress'];
  content: BaseNode['content'];
  extensions?: BaseNode['extensions'];
  [key: string]: unknown;
}

// Edge data specific to our application
export interface FlowEdgeData extends Record<string, unknown> {
  graphId: string;
  // Include base edge properties in the data
  properties: {
    type: string;
    status: string;
    [key: string]: unknown;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Flow-specific node type for visualization
export type FlowNode = ReactFlowNode<FlowNodeData>;

// Flow-specific edge type for visualization
export type FlowEdge = ReactFlowEdge<FlowEdgeData>;

// Flow-specific graph type for visualization
export interface FlowGraph extends Graph {
  nodes: (BaseNode & { position: XYPosition })[];
  edges: BaseEdge[];
}

// Workspace state interface
export interface WorkspaceState {
  graphs: FlowGraph[];
  isLoading: boolean;
  error: Error | null;
}

// Re-export the Node and Edge types from ReactFlow
export type { Node, Edge } from '@xyflow/react'; 