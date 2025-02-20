import { Node, Edge, Position } from '@xyflow/react';
import type { FlowNodeData, FlowEdgeData, FlowGraph } from '../types/workspace-types';

const positionMap = {
  'top': Position.Top,
  'right': Position.Right,
  'bottom': Position.Bottom,
  'left': Position.Left
} as const;

export const transformGraphsToReactFlow = (graphs: FlowGraph[]) => {
  // Combine all nodes and edges from all graphs
  const nodes: Node<FlowNodeData>[] = graphs.flatMap((graph: FlowGraph) =>
    graph.nodes.map((node) => ({
      id: node.nodeId,
      type: 'default',
      position: node.position,
      sourcePosition: node.properties.sourcePosition ? positionMap[node.properties.sourcePosition] : Position.Bottom,
      targetPosition: node.properties.targetPosition ? positionMap[node.properties.targetPosition] : Position.Top,
      data: {
        label: node.properties.title,
        description: node.properties.description,
        status: node.metadata.status,
        graphId: graph.graphId,
        graphName: graph.graphName,
        properties: node.properties,
        metadata: node.metadata,
        progress: node.progress,
        content: node.content,
        extensions: node.extensions
      },
      style: {
        background: node.nodeId === graph.rootNodeId ? '#e0f2e9' : '#fff',
        border: '1px solid #ddd',
        padding: 10,
        borderRadius: 5
      }
    }))
  );

  // Combine all edges from all graphs
  const edges: Edge<FlowEdgeData>[] = graphs.flatMap((graph: FlowGraph) =>
    graph.edges.map((edge) => ({
      id: edge.edgeId,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'default',
      data: {
        graphId: graph.graphId,
        properties: {
          type: edge.relationshipType,
          status: 'active'
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    }))
  );

  return { nodes, edges };
}; 