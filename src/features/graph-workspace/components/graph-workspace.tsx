import { ReactFlow, ReactFlowProvider, Background, Controls, Panel, useNodesState, useEdgesState, type Node, type Edge, OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphWorkspace } from '../hooks/use-graph-workspace';
import type { FlowNodeData, FlowEdgeData, FlowGraph } from '../types/workspace-types';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

interface GraphWorkspaceProps {
  userId: string;
}

const defaultViewport = { x: 0, y: 0, zoom: 1 };

const transformGraphsToReactFlow = (graphs: FlowGraph[]) => {
  // Combine all nodes and edges from all graphs
  const nodes: Node<FlowNodeData>[] = graphs.flatMap((graph: FlowGraph) =>
    graph.nodes.map((node) => ({
      id: node.nodeId,
      type: 'default',
      position: node.position,
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
        background: '#fff',
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

const GraphWorkspaceInner = ({ userId }: GraphWorkspaceProps) => {
  const { graphs, isLoading, error } = useGraphWorkspace(userId);
  const graphService = useMemo(() => new GraphService(userId), [userId]);
  
  // Initialize node and edge states with correct types
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FlowEdgeData>>([]);

  // Update nodes and edges when graphs change
  useEffect(() => {
    if (graphs.length > 0) {
      const { nodes: newNodes, edges: newEdges } = transformGraphsToReactFlow(graphs);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [graphs, setNodes, setEdges]);

  const onNodeDragStop: OnNodeDrag = useCallback(async (event, node) => {
    try {
      // Get the graph this node belongs to
      const graph = graphs.find(g => g.graphId === node.data.graphId);
      if (!graph) {
        console.error('Graph not found for node:', node);
        return;
      }

      // Convert display position back to node position by subtracting graph position
      const nodePosition = {
        x: node.position.x - (graph.graphPosition?.x || 0),
        y: node.position.y - (graph.graphPosition?.y || 0)
      };

      // Update the node position in Firestore
      await graphService.updateNode(graph.graphId, node.id, {
        nodePosition
      });
    } catch (error) {
      console.error('Failed to update node position:', error);
      toast.error('Failed to save node position');
    }
  }, [graphs, graphService]);

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-red-500">
        Error: {error.message}
      </div>
    );
  }

  if (!graphs.length) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        No graphs available
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        attributionPosition="bottom-right"
        onNodeDragStop={onNodeDragStop}
      >
        <Background />
        <Controls />
        <Panel position="top-left">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Workspace Graphs</h3>
            <div className="text-sm text-gray-600">
              {graphs.length} graph{graphs.length !== 1 ? 's' : ''} loaded
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const GraphWorkspace = (props: GraphWorkspaceProps) => (
  <ReactFlowProvider>
    <GraphWorkspaceInner {...props} />
  </ReactFlowProvider>
); 