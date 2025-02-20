import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphWorkspace } from '../hooks/use-graph-workspace';
import type { FlowNode, FlowEdge } from '../types/workspace-types';

interface GraphWorkspaceProps {
  userId: string;
  graphId: string;
}

const GraphWorkspaceInner = ({ userId, graphId }: GraphWorkspaceProps) => {
  const { graph, isLoading, error } = useGraphWorkspace(userId, graphId);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!graph) {
    return <div>No graph data available</div>;
  }

  // Map our FlowNodes to ReactFlow's expected format
  const reactFlowNodes = graph.nodes.map((node: FlowNode) => ({
    id: node.id,
    type: node.type,
    position: node.displayPosition,
    data: {
      title: node.properties.title,
      description: node.properties.description,
      status: node.metadata.status
    }
  }));

  // Map our FlowEdges to ReactFlow's expected format
  const reactFlowEdges = graph.edges.map((edge: FlowEdge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target
  }));

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        fitView
      />
    </div>
  );
};

export const GraphWorkspace = (props: GraphWorkspaceProps) => (
  <ReactFlowProvider>
    <GraphWorkspaceInner {...props} />
  </ReactFlowProvider>
); 