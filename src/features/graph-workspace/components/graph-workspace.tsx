import { 
  ReactFlow, 
  ReactFlowProvider, 
  Background, 
  Controls, 
  Panel, 
  useNodesState, 
  useEdgesState, 
  type Node, 
  type Edge, 
  OnNodeDrag, 
  useReactFlow, 
  useViewport, 
  useStoreApi 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphWorkspace } from '../hooks/use-graph-workspace';
import type { FlowNodeData, FlowEdgeData, FlowGraph } from '../types/workspace-types';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTemplateSelectionStore } from '@/features/side-bar/stores/template-selection-store';
import { useRootNodeCreationStore } from '@/features/side-bar/stores/root-node-creation-store';
import { TemplateService } from '@/shared/services/firebase/template-service';
import { auth } from '@/shared/services/firebase/config';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { DbGraph, DbNode } from '@/shared/types/db-types';

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

const PlacementGuide = ({ onCancel, message }: { onCancel: () => void; message: string }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
    <Alert className="bg-white/90 backdrop-blur-sm border-blue-200 shadow-lg">
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCancel}
        >
          Cancel
        </Button>
      </AlertDescription>
    </Alert>
  </div>
);

const ZOOM_THRESHOLD = 0.5; // Show title when zoom is less than this value
const MIN_FONT_SIZE = 16; // Minimum font size in pixels
const MAX_FONT_SIZE = 35; // Maximum font size in pixels
const BASE_FONT_SIZE = 24; // Base font size at zoom level 1

interface RootNodeTitleProps {
  graphs: FlowGraph[];
  nodes: Node<FlowNodeData>[];
}

const RootNodeTitle = ({ graphs, nodes }: RootNodeTitleProps) => {
  const { zoom } = useViewport();
  const store = useStoreApi();
  
  if (zoom >= ZOOM_THRESHOLD) return null;

  return (
    <>
      {graphs.map((graph) => {
        const rootNode = nodes.find(node => node.id === graph.rootNodeId);
        if (!rootNode) return null;

        // Get the current viewport transform
        const { transform } = store.getState();
        
        // Apply viewport transform to graph position
        const x = graph.graphPosition.x * transform[2] + transform[0];
        const y = graph.graphPosition.y * transform[2] + transform[1];

        // Calculate font size with limits
        const scaledFontSize = BASE_FONT_SIZE / zoom;
        const fontSize = Math.max(MIN_FONT_SIZE, Math.min(scaledFontSize, MAX_FONT_SIZE));

        return (
          <div
            key={graph.graphId}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
            style={{
              left: x,
              top: y,
              fontSize: `${fontSize}px`,
              opacity: Math.max(0, (ZOOM_THRESHOLD - zoom) / ZOOM_THRESHOLD),
            }}
          >
            <h1 className="font-bold text-gray-800/80 whitespace-nowrap text-center">
              {rootNode.data.label}
            </h1>
          </div>
        );
      })}
    </>
  );
};

const GraphWorkspaceInner = ({ userId }: GraphWorkspaceProps) => {
  const { graphs, isLoading, error, refresh } = useGraphWorkspace(userId);
  const graphService = useMemo(() => new GraphService(userId), [userId]);
  const { selectedTemplateId, clearSelection, isPlacementMode } = useTemplateSelectionStore();
  const { isCreationMode, setCreationMode } = useRootNodeCreationStore();
  const reactFlowInstance = useReactFlow();
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  
  // Initialize node and edge states with correct types
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FlowEdgeData>>([]);

  // Update nodes and edges when graphs change
  useEffect(() => {
    if (graphs.length > 0) {
      const { nodes: newNodes, edges: newEdges } = transformGraphsToReactFlow(graphs);
      setNodes(newNodes);
      setEdges(newEdges);
    } else {
      // Clear nodes and edges when there are no graphs
      setNodes([]);
      setEdges([]);
    }
  }, [graphs, setNodes, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent<Element, MouseEvent>, node: Node<FlowNodeData>) => {
    if (event.shiftKey) {
      setSelectedGraphId(node.data.graphId);
      event.preventDefault();
    } else {
      setSelectedGraphId(null);
    }
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(async (event, node) => {
    try {
      // Get the graph this node belongs to
      const graph = graphs.find(g => g.graphId === node.data.graphId);
      if (!graph) {
        console.error('Graph not found for node:', node);
        return;
      }

      if (selectedGraphId === node.data.graphId) {
        // If the graph is selected, update the graph position
        const deltaX = node.position.x - (graph.nodes.find(n => n.nodeId === node.id)?.position.x || 0);
        const deltaY = node.position.y - (graph.nodes.find(n => n.nodeId === node.id)?.position.y || 0);

        const newGraphPosition = {
          x: (graph.graphPosition?.x || 0) + deltaX,
          y: (graph.graphPosition?.y || 0) + deltaY,
        };

        // Update Firebase without refreshing
        await graphService.updateGraph(graph.graphId, {
          graphPosition: newGraphPosition,
        });

        // Update all nodes in the graph to maintain their relative positions
        const updatePromises = graph.nodes.map(graphNode => {
          return graphService.updateNode(graph.graphId, graphNode.nodeId, {
            nodePosition: graphNode.nodePosition // Keep the same relative position
          });
        });

        await Promise.all(updatePromises);

        // Update our local graphs state to match Firebase without triggering a refresh
        graphs.forEach(g => {
          if (g.graphId === graph.graphId) {
            g.graphPosition = newGraphPosition;
          }
        });
      } else {
        // Normal node movement
        const nodePosition = {
          x: node.position.x - (graph.graphPosition?.x || 0),
          y: node.position.y - (graph.graphPosition?.y || 0)
        };

        // Update Firebase without refreshing
        await graphService.updateNode(graph.graphId, node.id, {
          nodePosition
        });

        // Update our local graphs state to match Firebase without triggering a refresh
        const updatedNode = graph.nodes.find(n => n.nodeId === node.id);
        if (updatedNode) {
          updatedNode.nodePosition = nodePosition;
        }
      }
    } catch (error) {
      console.error('Failed to update position:', error);
      toast.error('Failed to save position');
    }
  }, [graphs, graphService, selectedGraphId]);

  const onNodeDrag: OnNodeDrag = useCallback((event, node) => {
    if (selectedGraphId === node.data.graphId) {
      // Get the graph this node belongs to
      const graph = graphs.find(g => g.graphId === node.data.graphId);
      if (!graph) return;

      // Calculate how much the dragged node has moved from its original position
      const originalNode = graph.nodes.find(n => n.nodeId === node.id);
      if (!originalNode) return;

      const deltaX = node.position.x - originalNode.position.x;
      const deltaY = node.position.y - originalNode.position.y;

      // Update positions of all nodes in the same graph
      setNodes((nds) => 
        nds.map((n) => {
          if (n.data.graphId === selectedGraphId) {
            const originalGraphNode = graph.nodes.find(gn => gn.nodeId === n.id);
            if (!originalGraphNode) return n;

            return {
              ...n,
              position: {
                x: originalGraphNode.position.x + deltaX,
                y: originalGraphNode.position.y + deltaY,
              },
            };
          }
          return n;
        })
      );
    }
  }, [selectedGraphId, graphs, setNodes]);

  const handlePaneClick = useCallback(async (event: React.MouseEvent) => {
    // Clear graph selection when clicking on the workspace
    setSelectedGraphId(null);

    // Get click position in flow coordinates
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    if (isPlacementMode && selectedTemplateId && auth?.currentUser && !isPlacing) {
      try {
        setIsPlacing(true);
        clearSelection(); // Clear selection immediately to remove guide
        toast.loading('Creating graph from template...', { id: 'template-placement' });
        
        const templateService = new TemplateService('texas_TEKS', 'Math');
        await templateService.copyTemplateToUserGraph({
          templateId: selectedTemplateId,
          userId: auth.currentUser.uid,
          newGraphId: crypto.randomUUID(),
          graphPosition: position,
        });

        await refresh(); // Refresh the workspace after placing the template
        toast.success('Template placed successfully', { id: 'template-placement' });
      } catch (error) {
        console.error('Failed to place template:', error);
        toast.error('Failed to place template', { id: 'template-placement' });
      } finally {
        setIsPlacing(false);
      }
    } else if (isCreationMode && auth?.currentUser && !isPlacing) {
      try {
        setIsPlacing(true);
        setCreationMode(false); // Clear creation mode immediately to remove guide
        toast.loading('Creating new root node...', { id: 'root-node-creation' });

        const newGraphId = crypto.randomUUID();
        const newNodeId = crypto.randomUUID();

        // Create the new graph
        const newGraph = {
          graphId: newGraphId,
          rootNodeId: newNodeId,
          subjectName: '',
          graphName: '',
          properties: {
            description: '',
            type: 'idea_map',
            status: 'active'
          },
          metadata: {
            fromTemplate: false,
            tags: []
          },
          progress: {
            completedNodes: 0,
            milestones: {}
          },
          settings: {
            progressTracking: true,
            displayOptions: {
              layout: 'user_defined',
              showProgress: true
            }
          },
          graphPosition: position
        } as unknown as DbGraph;

        // Create the root node
        const rootNode = {
          nodeId: newNodeId,
          properties: {
            title: '',
            description: '',
            type: 'concept'
          },
          metadata: {
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: []
          },
          content: {
            text: '',
            resources: []
          },
          nodePosition: { x: 0, y: 0 }
        } as unknown as DbNode;

        await graphService.createGraph(newGraph);
        await graphService.createNode(newGraphId, rootNode);

        await refresh(); // Refresh the workspace after creating the root node
        toast.success('Root node created successfully', { id: 'root-node-creation' });
      } catch (error) {
        console.error('Failed to create root node:', error);
        toast.error('Failed to create root node', { id: 'root-node-creation' });
      } finally {
        setIsPlacing(false);
      }
    }
  }, [isPlacementMode, selectedTemplateId, reactFlowInstance, clearSelection, isPlacing, refresh, auth?.currentUser, isCreationMode, setCreationMode, graphService]);

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

  return (
    <div className="h-screen w-full">
      {isPlacementMode && (
        <PlacementGuide 
          onCancel={clearSelection} 
          message="Click anywhere in the workspace to place your graph" 
        />
      )}
      {isCreationMode && (
        <PlacementGuide 
          onCancel={() => setCreationMode(false)} 
          message="Click anywhere in the workspace to place your new root node" 
        />
      )}
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
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={handlePaneClick}
        className={`${isPlacementMode || isCreationMode ? 'cursor-crosshair' : ''} ${selectedGraphId ? 'cursor-move' : ''}`}
      >
        <Background />
        <Controls />
        <RootNodeTitle graphs={graphs} nodes={nodes} />
        <Panel position="top-left">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Workspace Graphs</h3>
            <div className="text-sm text-gray-600">
              {graphs.length} graph{graphs.length !== 1 ? 's' : ''} loaded
              {selectedGraphId && (
                <div className="text-blue-600">
                  Graph selected - Moving entire graph
                </div>
              )}
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