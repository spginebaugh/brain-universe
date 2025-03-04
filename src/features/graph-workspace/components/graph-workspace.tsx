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
  useStoreApi,
  useOnSelectionChange,
  SelectionMode
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
import { useNodeSelectionStore } from '@/features/side-bar/stores/node-selection-store';
import { TemplateService } from '@/shared/services/firebase/template-service';
import { auth } from '@/shared/services/firebase/config';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { DbNode, DbEdge } from '@/shared/types/db-types';
import { NodeInfoDialog } from './node-info-dialog';
import { NodeMenu } from './node-menu';
import { NodeInfoPopup } from './node-info-popup';
import { useNodeRevealAnimation } from '../hooks/use-node-reveal-animation';
import {
  transformGraphsToReactFlow,
  calculateRelativePosition,
  calculateNodeDelta,
  updateNodesWithDelta,
  createNewNode,
  createNewGraph,
  handleAsyncOperation,
} from '../utils';
import { MultiNodeColorMenu } from '@/features/side-bar/components/multi-node-color-menu';

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
  const { graphs, isLoading, error } = useGraphWorkspace(userId);
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
  const { 
    selectedNodes, 
    setSelectedNodes, 
    clearSelectedNodes,
    isMultiEditMode,
    setMultiEditMode
  } = useNodeSelectionStore();
  const reactFlowInstance = useReactFlow();
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [menuNode, setMenuNode] = useState<Node<FlowNodeData> | null>(null);
  const [hiddenGraphIds, setHiddenGraphIds] = useState<Set<string>>(new Set());
  const [isMultiNodeColorMenuOpen, setIsMultiNodeColorMenuOpen] = useState(false);
  
  // Initialize node and edge states with correct types
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FlowEdgeData>>([]);

  // Use the animation hook
  const {
    isAnimating,
    filteredNodes,
    filteredEdges,
    startAnimation,
    handleNodeAnimationComplete,
    currentlyAnimatingNodeIds,
    nodesWithPopups
  } = useNodeRevealAnimation({
    nodes,
    edges,
    hiddenGraphIds,
    setHiddenGraphIds,
    menuNode
  });

  // Handle parallel animations for nodes without visible tooltips
  useEffect(() => {
    if (!isAnimating || !currentlyAnimatingNodeIds.size) return;
    
    // Process all animating nodes except those with visible popups
    const nodesToAnimate = Array.from(currentlyAnimatingNodeIds).filter(
      nodeId => !nodesWithPopups.some(node => node.id === nodeId)
    );
    
    // Set a timeout to trigger completion for each node without a popup
    const timeouts = nodesToAnimate.map(nodeId => {
      // Use a shorter timeout (200ms) for non-visible nodes to keep animations flowing
      return setTimeout(() => handleNodeAnimationComplete(nodeId), 200);
    });
    
    // Clean up timeouts on unmount
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [currentlyAnimatingNodeIds, nodesWithPopups, handleNodeAnimationComplete, isAnimating]);

  // Track selected nodes
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedNodes(nodes as Node<FlowNodeData>[]);
    },
  });

  // Watch for changes in multi-edit mode
  useEffect(() => {
    if (isMultiEditMode && selectedNodes.length > 1) {
      setIsMultiNodeColorMenuOpen(true);
    } else {
      setIsMultiNodeColorMenuOpen(false);
    }
  }, [isMultiEditMode, selectedNodes.length]);

  // Effect to transform graphs to ReactFlow format when they change
  useEffect(() => {
    if (!graphs.length || isAnimating) return;

    console.log('Transforming graphs to ReactFlow format after update');
    const { nodes: flowNodes, edges: flowEdges } = transformGraphsToReactFlow(graphs);
    
    // Update ReactFlow state with the transformed data
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphs, setNodes, setEdges, isAnimating]);

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
    } else if (!event.ctrlKey && !event.metaKey) {
      // If not holding Ctrl/Cmd, clear selection and select only this node
      setSelectedGraphId(null);
      
      // Show node menu on regular click (not multi-select)
      setMenuNode(node);
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
      // Show a loading indicator
      toast.loading('Creating edge...', { id: 'edge-creation' });
      
      const newEdge = {
        edgeId: crypto.randomUUID(),
        fromNodeId: selectedFirstNodeId,
        toNodeId: secondNodeId,
        isDirected: true,
        relationshipType: 'tree_edge',
      } as unknown as DbEdge; // Cast to DbEdge since we can't create a unique symbol

      await graphService.createEdge(selectedEdgeGraphId, newEdge);
      
      // The real-time listener will update the state, so we don't need to call refresh() here
      toast.success('Edge created successfully', { id: 'edge-creation' });
      resetEdgeCreation();
    } catch (error) {
      console.error('Failed to create edge:', error);
      toast.error('Failed to create edge', { id: 'edge-creation' });
      resetEdgeCreation();
    }
  }, [selectedFirstNodeId, selectedEdgeGraphId, graphService, resetEdgeCreation]);

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
    
    // Clear selected nodes when clicking on the pane (unless in multi-edit mode)
    if (!isMultiEditMode) {
      clearSelectedNodes();
    }

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

      setIsPlacing(true);
      toast.loading('Creating new node...', { id: 'node-creation' });
      
      try {
        const newNodeId = crypto.randomUUID();
        const relativePosition = calculateRelativePosition(position, parentGraph.graphPosition);
        const newNode = createNewNode(newNodeId, relativePosition);

        await graphService.createNode(selectedParentGraphId, newNode);
        
        // The real-time listener will handle the UI update
        toast.success('Node created successfully', { id: 'node-creation' });
        
        // Wait a bit to ensure the listener has fired and the node is in the state
        setTimeout(() => {
          const createdNode = nodes.find(n => n.id === newNodeId);
          if (createdNode) {
            setSelectedNode(createdNode);
            setIsInfoDialogOpen(true);
          }
          resetNodeCreation();
          setIsPlacing(false);
        }, 500);
      } catch (error) {
        console.error('Failed to create new node:', error);
        toast.error('Failed to create new node', { id: 'node-creation' });
        resetNodeCreation();
        setIsPlacing(false);
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

      setIsPlacing(true);
      toast.loading('Creating graph from template...', { id: 'template-placement' });
      
      try {
        clearSelection();
        const templateService = new TemplateService('texas_TEKS', 'Math');
        
        await templateService.copyTemplateToUserGraph({
          templateId: selectedTemplateId,
          userId: currentUser.uid,
          newGraphId: crypto.randomUUID(),
          graphPosition: position,
        });
        
        // The real-time listener will update the UI
        toast.success('Template placed successfully', { id: 'template-placement' });
      } catch (error) {
        console.error('Failed to place template:', error);
        toast.error('Failed to place template', { id: 'template-placement' });
      } finally {
        setIsPlacing(false);
      }
    } else if (isRootNodeCreationMode && !isPlacing) {
      const currentUser = auth?.currentUser;
      if (!currentUser?.uid) {
        console.error('User not authenticated');
        return;
      }

      setRootNodeCreationMode(false);
      toast.loading('Creating new root node...', { id: 'root-creation' });
      
      const newGraphId = crypto.randomUUID();
      const newNodeId = crypto.randomUUID();
      const newGraph = createNewGraph(newGraphId, newNodeId, position);
      const rootNode = createNewNode(newNodeId, { x: 0, y: 0 });

      try {
        await graphService.createGraph(newGraph);
        await graphService.createNode(newGraphId, rootNode);
        
        // The real-time listener will update the state
        toast.success('Root node created successfully', { id: 'root-creation' });
      } catch (error) {
        console.error('Failed to create root node:', error);
        toast.error('Failed to create root node', { id: 'root-creation' });
      }
    }
  }, [isNewNodeCreationMode, selectedParentGraphId, reactFlowInstance, graphService, graphs, nodes, isPlacing, isPlacementMode, selectedTemplateId, clearSelection, isRootNodeCreationMode, setRootNodeCreationMode, isMultiEditMode, clearSelectedNodes]);

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
          
          // The real-time listener will handle the state update, but we need the 
          // new node for the dialog, so we'll wait a short time to ensure the listener has fired
          setTimeout(() => {
            const createdNode = nodes.find(n => n.id === newNodeId);
            if (createdNode) {
              setSelectedNode(createdNode);
              setIsInfoDialogOpen(true);
            }
          }, 500);

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
    [connectingNodeId, reactFlowInstance, nodes, graphs, graphService]
  );

  // Toggle visibility handler for the node menu
  const handleToggleVisibility = useCallback(() => {
    if (isAnimating || !menuNode) return;
    
    const graphId = menuNode.data.graphId;
    
    setHiddenGraphIds(prevHiddenGraphIds => {
      const newHiddenGraphIds = new Set(prevHiddenGraphIds);
      if (newHiddenGraphIds.has(graphId)) {
        newHiddenGraphIds.delete(graphId);
      } else {
        newHiddenGraphIds.add(graphId);
      }
      return newHiddenGraphIds;
    });
  }, [isAnimating, menuNode]);

  // Start the animation when requested from the menu
  const handleStartAnimation = useCallback(() => {
    if (!menuNode) return;
    startAnimation(menuNode.data.graphId);
    // Hide the menu after starting animation
    setMenuNode(null);
  }, [menuNode, startAnimation]);

  const handleCloseMultiNodeColorMenu = useCallback(() => {
    setIsMultiNodeColorMenuOpen(false);
    setMultiEditMode(false);
  }, [setMultiEditMode]);

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
      <MultiNodeColorMenu
        userId={userId}
        isOpen={isMultiNodeColorMenuOpen}
        onClose={handleCloseMultiNodeColorMenu}
      />
      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
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
        multiSelectionKeyCode="Control"
        selectionOnDrag={false}
        selectionMode={isMultiEditMode ? SelectionMode.Partial : SelectionMode.Full}
        className={`${isPlacementMode || isRootNodeCreationMode || isNewNodeCreationMode || isEdgeCreationMode ? 'cursor-crosshair' : ''} ${selectedGraphId ? 'cursor-move' : ''}`}
      >
        <Background />
        <Controls />
        {menuNode && (
          <NodeMenu
            node={menuNode}
            onInfoClick={() => handleOpenInfoDialog(menuNode)}
            onClose={handleCloseMenu}
            onToggleVisibility={handleToggleVisibility}
            onStartAnimation={handleStartAnimation}
            areNodesHidden={hiddenGraphIds.has(menuNode.data.graphId)}
          />
        )}
        {/* Render a NodeInfoPopup for each node in the nodesWithPopups array */}
        {nodesWithPopups.map(node => (
          <NodeInfoPopup
            key={node.id}
            node={node}
            onAnimationComplete={handleNodeAnimationComplete}
          />
        ))}
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
              {selectedNodes.length > 0 && (
                <div className="text-green-600">
                  {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
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