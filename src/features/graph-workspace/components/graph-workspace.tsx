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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingGraphId, setAnimatingGraphId] = useState<string | null>(null);
  const [animationNodeIndex, setAnimationNodeIndex] = useState(0);
  const [animationNodes, setAnimationNodes] = useState<Node<FlowNodeData>[]>([]);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [currentAnimatingNode, setCurrentAnimatingNode] = useState<Node<FlowNodeData> | null>(null);
  const [isMultiNodeColorMenuOpen, setIsMultiNodeColorMenuOpen] = useState(false);
  
  // Initialize node and edge states with correct types
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FlowEdgeData>>([]);

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
  }, [isNewNodeCreationMode, selectedParentGraphId, reactFlowInstance, graphService, refresh, resetNodeCreation, graphs, nodes, isPlacing, isPlacementMode, selectedTemplateId, clearSelection, isRootNodeCreationMode, setRootNodeCreationMode, isMultiEditMode, clearSelectedNodes]);

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

  // Function to toggle visibility of non-root nodes and edges in the current graph
  const handleToggleVisibility = useCallback(() => {
    if (isAnimating || !menuNode) return; // Prevent toggling while animation is in progress
    
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

  // Function to sort nodes in the desired order for animation
  const sortNodesForAnimation = useCallback((nodes: Node<FlowNodeData>[], graphId: string) => {
    const sorted: Node<FlowNodeData>[] = [];
    
    // Get all nodes for this graph
    const graphNodes = nodes.filter(node => node.data.graphId === graphId);
    
    // Find the root node for this graph
    const rootNode = graphNodes.find(node => node.style?.background === '#e0f2e9');
    if (!rootNode) return graphNodes; // Fallback if no root node found
    
    // Get all edges for this graph to understand connections
    const graphEdges = edges.filter(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode && sourceNode.data.graphId === graphId;
    });
    
    // Build a map of parent to children relationships
    const childrenMap: Record<string, string[]> = {};
    const parentMap: Record<string, string> = {};
    
    // Initialize for all nodes
    graphNodes.forEach(node => {
      childrenMap[node.id] = [];
    });
    
    // Populate the maps using edges
    graphEdges.forEach(edge => {
      // Add child to parent's children list
      if (childrenMap[edge.source]) {
        childrenMap[edge.source].push(edge.target);
      }
      
      // Record parent of child
      parentMap[edge.target] = edge.source;
    });
    
    // Function to check if a node is a parent (has children)
    const isParentNode = (nodeId: string) => childrenMap[nodeId]?.length > 0;
    
    // First add the root node
    sorted.push(rootNode);
    
    // Find the primary parent node (directly connected to root)
    const primaryParents = childrenMap[rootNode.id] || [];
    
    // Function to process a parent node and its children
    const processParentChain = (parentNodeId: string, processedNodes = new Set<string>()) => {
      if (processedNodes.has(parentNodeId)) return; // Prevent cycles
      processedNodes.add(parentNodeId);
      
      // Add the parent node
      const parentNode = graphNodes.find(n => n.id === parentNodeId);
      if (parentNode && !sorted.some(n => n.id === parentNodeId)) {
        sorted.push(parentNode);
      }
      
      // Get all children
      const children = childrenMap[parentNodeId] || [];
      
      // First process non-parent children
      const nonParentChildren = children.filter(childId => !isParentNode(childId));
      nonParentChildren.forEach(childId => {
        const childNode = graphNodes.find(n => n.id === childId);
        if (childNode && !sorted.some(n => n.id === childId)) {
          sorted.push(childNode);
        }
      });
      
      // Then process parent children (follow the chain)
      const parentChildren = children.filter(childId => isParentNode(childId));
      parentChildren.forEach(childId => {
        processParentChain(childId, processedNodes);
      });
    };
    
    // Process each primary parent and its chain
    primaryParents.forEach(parentId => {
      processParentChain(parentId, new Set<string>());
    });
    
    // Make sure all nodes are included by adding any we missed
    graphNodes.forEach(node => {
      if (!sorted.some(n => n.id === node.id)) {
        sorted.push(node);
      }
    });
    
    return sorted;
  }, [edges, nodes]);

  // Start the animation sequence for the current graph
  const handleStartAnimation = useCallback(() => {
    if (isAnimating || !menuNode) return;
    
    const graphId = menuNode.data.graphId;
    
    // Only proceed if this graph is hidden
    if (!hiddenGraphIds.has(graphId)) return;
    
    // Prepare the animation sequence for this graph only
    const nodesToAnimate = sortNodesForAnimation(nodes, graphId);
    setAnimationNodes(nodesToAnimate);
    setAnimationNodeIndex(0);
    setVisibleNodeIds(new Set());
    setIsAnimating(true);
    setAnimatingGraphId(graphId);
    
    // Start with the first node (if available)
    if (nodesToAnimate.length > 0) {
      setCurrentAnimatingNode(nodesToAnimate[0]);
      setVisibleNodeIds(new Set([nodesToAnimate[0].id]));
    } else {
      setIsAnimating(false);
      setAnimatingGraphId(null);
    }
  }, [hiddenGraphIds, isAnimating, menuNode, nodes, sortNodesForAnimation]);

  // Handle completion of a single node animation
  const handleNodeAnimationComplete = useCallback(() => {
    setCurrentAnimatingNode(null);
    
    // Short delay before moving to next node
    setTimeout(() => {
      const nextIndex = animationNodeIndex + 1;
      
      if (nextIndex < animationNodes.length) {
        // Move to the next node
        setAnimationNodeIndex(nextIndex);
        setCurrentAnimatingNode(animationNodes[nextIndex]);
        setVisibleNodeIds(prev => {
          const newSet = new Set(prev);
          newSet.add(animationNodes[nextIndex].id);
          return newSet;
        });
      } else {
        // Animation sequence completed for this graph
        if (animatingGraphId) {
          setHiddenGraphIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(animatingGraphId);
            return newSet;
          });
        }
        setIsAnimating(false);
        setAnimatingGraphId(null);
        setAnimationNodeIndex(0);
        setAnimationNodes([]);
        setVisibleNodeIds(new Set());
      }
    }, 300); // Reduced from 500ms for faster animation
  }, [animationNodeIndex, animationNodes, animatingGraphId]);

  // Filter nodes and edges based on visibility state
  const filteredNodes = useMemo(() => {
    if (!hiddenGraphIds.size && !isAnimating) {
      return nodes;
    }

    return nodes.filter(node => {
      const graphId = node.data.graphId;
      const isRootNode = node.style?.background === '#e0f2e9';
      const isMenuNode = menuNode && node.id === menuNode.id;
      
      // Always show nodes from non-hidden graphs
      if (!hiddenGraphIds.has(graphId)) {
        return true;
      }
      
      // For hidden graphs that are not being animated
      if (graphId !== animatingGraphId) {
        return isRootNode || isMenuNode;
      }
      
      // For the graph being animated
      if (isAnimating && graphId === animatingGraphId) {
        const isVisible = visibleNodeIds.has(node.id);
        return isRootNode || isVisible || isMenuNode;
      }
      
      // Default case for hidden graphs
      return isRootNode || isMenuNode;
    });
  }, [nodes, hiddenGraphIds, menuNode, isAnimating, animatingGraphId, visibleNodeIds]);

  const filteredEdges = useMemo(() => {
    if (!hiddenGraphIds.size && !isAnimating) {
      return edges;
    }
    
    return edges.filter(edge => {
      // First, find the source node to determine which graph this edge belongs to
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) return false;
      
      const graphId = sourceNode.data.graphId;
      
      // Always show edges from non-hidden graphs
      if (!hiddenGraphIds.has(graphId)) {
        return true;
      }
      
      // Hide all edges for hidden graphs that are not being animated
      if (graphId !== animatingGraphId) {
        return false;
      }
      
      // For the graph being animated, only show edges where both nodes are visible
      if (isAnimating && graphId === animatingGraphId) {
        const sourceVisible = visibleNodeIds.has(edge.source) || sourceNode.style?.background === '#e0f2e9';
        const targetNode = nodes.find(n => n.id === edge.target);
        const targetVisible = targetNode && (visibleNodeIds.has(edge.target) || targetNode.style?.background === '#e0f2e9');
        return sourceVisible && targetVisible;
      }
      
      // Default case for hidden graphs
      return false;
    });
  }, [edges, nodes, hiddenGraphIds, isAnimating, animatingGraphId, visibleNodeIds]);

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
        {currentAnimatingNode && (
          <NodeInfoPopup
            node={currentAnimatingNode}
            onAnimationComplete={handleNodeAnimationComplete}
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