import { Node } from '@xyflow/react';
import { FlowNodeData, FlowGraph } from '../types/workspace-types';

export interface Position {
  x: number;
  y: number;
}

export const calculateRelativePosition = (
  absolutePosition: Position,
  graphPosition: Position = { x: 0, y: 0 }
): Position => ({
  x: absolutePosition.x - graphPosition.x,
  y: absolutePosition.y - graphPosition.y
});

export const calculateNodeDelta = (
  node: Node<FlowNodeData>,
  graph: FlowGraph
): Position => {
  const originalNode = graph.nodes.find(n => n.nodeId === node.id);
  if (!originalNode) return { x: 0, y: 0 };

  return {
    x: node.position.x - originalNode.position.x,
    y: node.position.y - originalNode.position.y
  };
};

export const updateNodesWithDelta = (
  nodes: Node<FlowNodeData>[],
  selectedGraphId: string,
  graph: FlowGraph,
  delta: Position
): Node<FlowNodeData>[] => {
  return nodes.map((n) => {
    if (n.data.graphId === selectedGraphId) {
      const originalGraphNode = graph.nodes.find(gn => gn.nodeId === n.id);
      if (!originalGraphNode) return n;

      return {
        ...n,
        position: {
          x: originalGraphNode.position.x + delta.x,
          y: originalGraphNode.position.y + delta.y,
        },
      };
    }
    return n;
  });
}; 