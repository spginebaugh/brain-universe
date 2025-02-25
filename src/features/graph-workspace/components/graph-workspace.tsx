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
  type OnConnectStart,
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
import { useNodeCreationStore } from '@/features/side-bar/stores/node-creation-store';
import { useEdgeCreationStore } from '@/features/side-bar/stores/edge-creation-store';
import { TemplateService } from '@/shared/services/firebase/template-service';
import { auth } from '@/shared/services/firebase/config';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { DbNode, DbEdge } from '@/shared/types/db-types';
import { NodeInfoDialog } from './node-info-dialog';
import { NodeMenu } from './node-menu';
import {
  transformGraphsToReactFlow,
  calculateRelativePosition,
  calculateNodeDelta,
  updateNodesWithDelta,
  createNewNode,
  createNewGraph,
  handleAsyncOperation,
} from '../utils';

interface GraphWorkspaceProps {
  userId: string;
}

const defaultViewport = { x: 0, y: 0, zoom: 1 };

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
  const { isCreationMode: isRootNodeCreationMode, setCreationMode: setRootNodeCreationMode } = useRootNodeCreationStore();
  const { 
    isCreationMode: isNewNodeCreationMode, 
    selectedParentGraphId,
    setSelectedParentGraphId,
    reset: resetNodeCreation 
  } = useNodeCreationStore();
  const {
    isCreationMode: isEdgeCreationMode,
    selectedFirstNodeId,
    selectedGraphId: selectedEdgeGraphId,
    setSelectedFirstNode,
    resetSelection: resetEdgeCreation
  } = useEdgeCreationStore();
  const reactFlowInstance = useReactFlow();
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [menuNode, setMenuNode] = useState<Node<FlowNodeData> | null>(null);
  
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
    // Close menu if clicking a different node
    if (menuNode && menuNode.id !== node.id) {
      setMenuNode(null);
    }

    if (isNewNodeCreationMode && !selectedParentGraphId) {
      setSelectedParentGraphId(node.data.graphId);
      event.preventDefault();
      return;
    }

    if (isEdgeCreationMode) {
      if (!selectedFirstNodeId) {
        setSelectedFirstNode(node.id, node.data.graphId);
      } else {
        handleSecondNodeSelection(node.id, node.data.graphId);
      }
      event.preventDefault();
      return;
    }
    
    if (event.shiftKey) {
      setSelectedGraphId(node.data.graphId);
      event.preventDefault();
    } else {
      setSelectedGraphId(null);
    }
  }, [isNewNodeCreationMode, selectedParentGraphId, setSelectedParentGraphId, isEdgeCreationMode, selectedFirstNodeId, setSelectedFirstNode, menuNode]);

  const handleSecondNodeSelection = useCallback(async (secondNodeId: string, secondNodeGraphId: string) => {
    if (!selectedFirstNodeId || !selectedEdgeGraphId) return;
    
    // Verify both nodes are from the same graph
    if (selectedEdgeGraphId !== secondNodeGraphId) {
      alert('Error: Both nodes must be from the same graph');
      resetEdgeCreation();
      return;
    }

    try {
      const newEdge = {
        edgeId: crypto.randomUUID(),
        fromNodeId: selectedFirstNodeId,
        toNodeId: secondNodeId,
        isDirected: true,
        relationshipType: 'tree_edge',
      } as unknown as DbEdge; // Cast to DbEdge since we can't create a unique symbol

      await graphService.createEdge(selectedEdgeGraphId, newEdge);
      await refresh();
      resetEdgeCreation();
    } catch (error) {
      console.error('Failed to create edge:', error);
      alert('Failed to create edge. Please try again.');
      resetEdgeCreation();
    }
  }, [selectedFirstNodeId, selectedEdgeGraphId, graphService, refresh, resetEdgeCreation]);

  const onNodeDragStop: OnNodeDrag = useCallback(async (event, node) => {
    const graph = graphs.find(g => g.graphId === node.data.graphId);
    if (!graph) {
      console.error('Graph not found for node:', node);
      return;
    }

    if (selectedGraphId === node.data.graphId) {
      const delta = calculateNodeDelta(node as Node<FlowNodeData>, graph);
      const newGraphPosition = {
        x: (graph.graphPosition?.x || 0) + delta.x,
        y: (graph.graphPosition?.y || 0) + delta.y,
      };

      await handleAsyncOperation(
        async () => {
          await graphService.updateGraph(graph.graphId, { graphPosition: newGraphPosition });
          const updatePromises = graph.nodes.map(graphNode => 
            graphService.updateNode(graph.graphId, graphNode.nodeId, {
              nodePosition: graphNode.nodePosition
            })
          );
          await Promise.all(updatePromises);
          graphs.forEach(g => {
            if (g.graphId === graph.graphId) {
              g.graphPosition = newGraphPosition;
            }
          });
        },
        {
          loadingMessage: 'Updating graph position...',
          successMessage: 'Graph position updated',
          errorMessage: 'Failed to update graph position',
          toastId: 'graph-position-update'
        }
      );
    } else {
      const nodePosition = calculateRelativePosition(node.position, graph.graphPosition);
      await handleAsyncOperation(
        async () => {
          await graphService.updateNode(graph.graphId, node.id, { nodePosition });
          const updatedNode = graph.nodes.find(n => n.nodeId === node.id);
          if (updatedNode) {
            updatedNode.nodePosition = nodePosition;
          }
        },
        {
          loadingMessage: 'Updating node position...',
          successMessage: 'Node position updated',
          errorMessage: 'Failed to update node position',
          toastId: 'node-position-update'
        }
      );
    }
  }, [graphs, graphService, selectedGraphId]);

  const onNodeDrag: OnNodeDrag = useCallback((event, node) => {
    // Close menu if the dragged node is the one with the menu open
    if (menuNode?.id === node.id) {
      setMenuNode(null);
    }

    if (selectedGraphId === node.data.graphId) {
      const graph = graphs.find(g => g.graphId === node.data.graphId);
      if (!graph) {
        console.error('Graph not found for node:', node);
        return;
      }

      const delta = calculateNodeDelta(node as Node<FlowNodeData>, graph);
      if (selectedGraphId) {
        setNodes(nodes => updateNodesWithDelta(nodes, selectedGraphId, graph, delta));
      }
    }
  }, [selectedGraphId, graphs, setNodes, menuNode]);

  const handlePaneClick = useCallback(async (event: React.MouseEvent) => {
    // Close menu when clicking on the pane
    setMenuNode(null);

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (isNewNodeCreationMode && selectedParentGraphId && !isPlacing) {
      const parentGraph = graphs.find(g => g.graphId === selectedParentGraphId);
      if (!parentGraph) {
        console.error('Parent graph not found');
        return;
      }

      const newNodeId = crypto.randomUUID();
      const relativePosition = calculateRelativePosition(position, parentGraph.graphPosition);
      const newNode = createNewNode(newNodeId, relativePosition);

      const result = await handleAsyncOperation(
        async () => {
          await graphService.createNode(selectedParentGraphId, newNode);
          await refresh();
          resetNodeCreation();
          return newNodeId;
        },
        {
          loadingMessage: 'Creating new node...',
          successMessage: 'Node created successfully',
          errorMessage: 'Failed to create new node',
          toastId: 'node-creation'
        }
      );

      if (result) {
        const createdNode = nodes.find(n => n.id === result);
        if (createdNode) {
          setSelectedNode(createdNode);
          setIsInfoDialogOpen(true);
        }
      }
      return;
    }

    setSelectedGraphId(null);

    if (isPlacementMode && selectedTemplateId && !isPlacing) {
      const currentUser = auth?.currentUser;
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        return;
      }

      clearSelection();
      const templateService = new TemplateService('texas_TEKS', 'Math');
      
      await handleAsyncOperation(
        async () => {
          await templateService.copyTemplateToUserGraph({
            templateId: selectedTemplateId,
            userId: currentUser.uid,
            newGraphId: crypto.randomUUID(),
            graphPosition: position,
          });
          await refresh();
        },
        {
          loadingMessage: 'Creating graph from template...',
          successMessage: 'Template placed successfully',
          errorMessage: 'Failed to place template',
          toastId: 'template-placement'
        }
      );
    } else if (isRootNodeCreationMode && !isPlacing) {
      const currentUser = auth?.currentUser;
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        return;
      }

      setRootNodeCreationMode(false);
      
      const newGraphId = crypto.randomUUID();
      const newNodeId = crypto.randomUUID();
      const newGraph = createNewGraph(newGraphId, newNodeId, position);
      const rootNode = createNewNode(newNodeId, { x: 0, y: 0 });

      await handleAsyncOperation(
        async () => {
          await graphService.createGraph(newGraph);
          await graphService.createNode(newGraphId, rootNode);
          await refresh();
        },
        {
          loadingMessage: 'Creating new root node...',
          successMessage: 'Root node created successfully',
          errorMessage: 'Failed to create root node',
          toastId: 'root-node-creation'
        }
      );
    }
  }, [isNewNodeCreationMode, selectedParentGraphId, reactFlowInstance, graphService, refresh, resetNodeCreation, graphs, nodes, isPlacing, isPlacementMode, selectedTemplateId, clearSelection, isRootNodeCreationMode, setRootNodeCreationMode]);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<FlowNodeData>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuNode(node);
  }, []);

  const handleCloseInfoDialog = useCallback(() => {
    setIsInfoDialogOpen(false);
    setSelectedNode(null);
  }, []);

  const handleOpenInfoDialog = useCallback((node: Node<FlowNodeData>) => {
    setSelectedNode(node);
    setIsInfoDialogOpen(true);
    setMenuNode(null);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuNode(null);
  }, []);

  const onConnectStart: OnConnectStart = useCallback((event, params) => {
    setConnectingNodeId(params.nodeId);
  }, []);

  const onConnectEnd = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      if (!connectingNodeId) return;

      const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');
      if (targetIsPane) {
        // Get the position where the edge was dropped
        const position = reactFlowInstance.screenToFlowPosition({
          x: (event as MouseEvent).clientX || (event as TouchEvent).touches?.[0]?.clientX || 0,
          y: (event as MouseEvent).clientY || (event as TouchEvent).touches?.[0]?.clientY || 0,
        });

        try {
          setIsPlacing(true);
          toast.loading('Creating new node...', { id: 'node-creation' });

          // Get the source node to determine which graph to add to
          const sourceNode = nodes.find(n => n.id === connectingNodeId);
          if (!sourceNode) throw new Error('Source node not found');

          const graphId = sourceNode.data.graphId;
          const newNodeId = crypto.randomUUID();
          const newEdgeId = crypto.randomUUID();

          // Get the parent graph
          const parentGraph = graphs.find(g => g.graphId === graphId);
          if (!parentGraph) throw new Error('Parent graph not found');

          // Calculate relative position by subtracting graph position
          const relativePosition = calculateRelativePosition(position, parentGraph.graphPosition);

          // Create the new node
          const newNode = {
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
              mainText: '',
              resources: []
            },
            nodePosition: relativePosition
          } as unknown as DbNode;

          // Create the new edge
          const newEdge = {
            edgeId: newEdgeId,
            fromNodeId: connectingNodeId,
            toNodeId: newNodeId,
            isDirected: true,
            relationshipType: 'tree_edge',
          } as unknown as DbEdge;

          // Save both to Firestore
          await graphService.createNode(graphId, newNode);
          await graphService.createEdge(graphId, newEdge);
          await refresh();

          // Open the node info dialog for immediate editing
          const createdNode = nodes.find(n => n.id === newNodeId);
          if (createdNode) {
            setSelectedNode(createdNode);
            setIsInfoDialogOpen(true);
          }

          toast.success('Node created successfully', { id: 'node-creation' });
        } catch (error) {
          console.error('Failed to create node on edge drop:', error);
          toast.error('Failed to create node', { id: 'node-creation' });
        } finally {
          setIsPlacing(false);
          setConnectingNodeId(null);
        }
      }
    },
    [connectingNodeId, reactFlowInstance, nodes, graphs, graphService, refresh]
  );

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
      <NodeInfoDialog 
        node={selectedNode}
        isOpen={isInfoDialogOpen}
        onClose={handleCloseInfoDialog}
        userId={userId}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={handlePaneClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        attributionPosition="bottom-right"
        className={`${isPlacementMode || isRootNodeCreationMode || isNewNodeCreationMode || isEdgeCreationMode ? 'cursor-crosshair' : ''} ${selectedGraphId ? 'cursor-move' : ''}`}
      >
        <Background />
        <Controls />
        {menuNode && (
          <NodeMenu
            node={menuNode}
            onInfoClick={() => handleOpenInfoDialog(menuNode)}
            onClose={handleCloseMenu}
          />
        )}
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
        {isPlacementMode && (
          <PlacementGuide 
            onCancel={clearSelection} 
            message="Click anywhere in the workspace to place your graph" 
          />
        )}
        {isRootNodeCreationMode && (
          <PlacementGuide 
            onCancel={() => setRootNodeCreationMode(false)} 
            message="Click anywhere in the workspace to place your new root node" 
          />
        )}
        {isNewNodeCreationMode && !selectedParentGraphId && (
          <PlacementGuide 
            onCancel={resetNodeCreation} 
            message="Select a graph to create new node in" 
          />
        )}
        {isNewNodeCreationMode && selectedParentGraphId && (
          <PlacementGuide 
            onCancel={resetNodeCreation} 
            message="Click anywhere to place new node" 
          />
        )}
        {isEdgeCreationMode && (
          <PlacementGuide 
            onCancel={resetEdgeCreation} 
            message={!selectedFirstNodeId 
              ? "Select First Node" 
              : "Select Second Node from the same graph"} 
          />
        )}
      </ReactFlow>
    </div>
  );
};

export const GraphWorkspace = (props: GraphWorkspaceProps) => (
  <ReactFlowProvider>
    <GraphWorkspaceInner {...props} />
  </ReactFlowProvider>
); 