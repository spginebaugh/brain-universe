import { useState, useCallback, useMemo, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { FlowNodeData, FlowEdgeData } from '../types/workspace-types';

interface NodeAnimation {
  nodeId: string;
  graphId: string;
  isParent: boolean;
  childrenIds?: string[];
}

interface UseNodeRevealAnimationProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
  hiddenGraphIds: Set<string>;
  setHiddenGraphIds: (callback: (prev: Set<string>) => Set<string>) => void;
  menuNode: Node<FlowNodeData> | null;
}

interface UseNodeRevealAnimationReturn {
  isAnimating: boolean;
  animatingGraphId: string | null;
  currentAnimatingNode: Node<FlowNodeData> | null;
  nodesWithPopups: Node<FlowNodeData>[];
  visibleNodeIds: Set<string>;
  filteredNodes: Node<FlowNodeData>[];
  filteredEdges: Edge<FlowEdgeData>[];
  startAnimation: (graphId: string) => void;
  stopAnimation: () => void;
  handleNodeAnimationComplete: (nodeId: string) => void;
  currentlyAnimatingNodeIds: Set<string>;
}

export function useNodeRevealAnimation({
  nodes,
  edges,
  hiddenGraphIds,
  setHiddenGraphIds,
  menuNode
}: UseNodeRevealAnimationProps): UseNodeRevealAnimationReturn {
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingGraphId, setAnimatingGraphId] = useState<string | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [animatingNodes, setAnimatingNodes] = useState<Map<string, NodeAnimation>>(new Map());
  const [currentlyAnimatingNodeIds, setCurrentlyAnimatingNodeIds] = useState<Set<string>>(new Set());
  const [currentAnimatingNode, setCurrentAnimatingNode] = useState<Node<FlowNodeData> | null>(null);
  const [nodesWithPopups, setNodesWithPopups] = useState<Node<FlowNodeData>[]>([]);
  
  // Queue of parent nodes waiting to be animated
  const parentNodeQueue = useRef<Node<FlowNodeData>[]>([]);
  // Keep track of which children need to be animated for each parent
  const childrenToAnimate = useRef<Map<string, string[]>>(new Map());
  // Track which child is currently being animated for each parent
  const currentChildIndices = useRef<Map<string, number>>(new Map());
  // Track which parent nodes have completed their animation
  const completedParentNodes = useRef<Set<string>>(new Set());
  // Track active animation chains
  const activeAnimationChains = useRef<Map<string, boolean>>(new Map());
  
  // Add node to popups
  const addNodeToPopups = useCallback((node: Node<FlowNodeData>) => {
    setNodesWithPopups(prev => {
      // Check if the node is already in the array
      if (prev.some(n => n.id === node.id)) {
        return prev;
      }
      return [...prev, node];
    });
  }, []);

  // Remove node from popups
  const removeNodeFromPopups = useCallback((nodeId: string) => {
    setNodesWithPopups(prev => prev.filter(node => node.id !== nodeId));
  }, []);

  // Helper function to find a node's parent id
  const findParentId = useCallback((nodeId: string) => {
    // Look through edges to find this node's parent
    const edge = edges.find(edge => edge.target === nodeId);
    return edge?.source;
  }, [edges]);

  // Start animating a child node
  const startChildAnimation = useCallback((parentId: string, childIndex: number) => {
    const children = childrenToAnimate.current.get(parentId) || [];
    if (childIndex >= children.length) return false;
    
    const childId = children[childIndex];
    const childNode = nodes.find(node => node.id === childId);
    
    if (childNode) {
      // Update the child index tracker
      currentChildIndices.current.set(parentId, childIndex);
      
      // Start animating this child node
      setCurrentlyAnimatingNodeIds(prev => {
        const newSet = new Set(prev);
        newSet.add(childId);
        return newSet;
      });
      
      // Add to visible nodes
      setVisibleNodeIds(prev => {
        const newSet = new Set(prev);
        newSet.add(childId);
        return newSet;
      });
      
      // Add to popups
      addNodeToPopups(childNode);
      
      // Create or update animation chain for this parent's children
      activeAnimationChains.current.set(`child-${parentId}`, true);
      
      return true;
    }
    
    return false;
  }, [nodes, addNodeToPopups]);

  // Start the animation sequence for a graph
  const startAnimation = useCallback((graphId: string) => {
    if (isAnimating || !graphId) return;
    
    // Only proceed if this graph is hidden
    if (!hiddenGraphIds.has(graphId)) return;
    
    // Find the root node to make it visible from the start
    const rootNode = nodes.find(node => 
      node.data.graphId === graphId && node.style?.background === '#e0f2e9'
    );
    
    // Get all nodes for this graph
    const graphNodes = nodes.filter(node => node.data.graphId === graphId);
    
    // Initialize with root node visible (if found)
    const initialVisibleNodes = new Set<string>();
    if (rootNode) {
      initialVisibleNodes.add(rootNode.id);
    }
    
    setVisibleNodeIds(initialVisibleNodes);
    setIsAnimating(true);
    setAnimatingGraphId(graphId);
    
    // Reset tracking variables
    childrenToAnimate.current = new Map();
    currentChildIndices.current = new Map();
    completedParentNodes.current = new Set();
    activeAnimationChains.current = new Map();
    
    // Build parent-child relationship map for animation
    const animationMap = new Map<string, NodeAnimation>();
    
    // Get all graph edges
    const graphEdges = edges.filter(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode && sourceNode.data.graphId === graphId;
    });
    
    // Build a map of direct children for each node
    const directChildrenMap: Record<string, Set<string>> = {};
    
    // Initialize empty sets for all nodes
    graphNodes.forEach(node => {
      directChildrenMap[node.id] = new Set<string>();
    });
    
    // Populate the direct children map
    graphEdges.forEach(edge => {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // Add target as direct child of source
      if (directChildrenMap[sourceId]) {
        directChildrenMap[sourceId].add(targetId);
      } else {
        directChildrenMap[sourceId] = new Set<string>([targetId]);
      }
    });
    
    // Function to check if a node is a parent (has children)
    const isParentNode = (nodeId: string) => directChildrenMap[nodeId]?.size > 0;
    
    // Track all nodes that are considered parents
    const parentNodeIds = new Set<string>();
    
    // Find all nodes that have outgoing edges (potential parents)
    graphNodes.forEach(node => {
      if (isParentNode(node.id) && node.id !== rootNode?.id) {
        parentNodeIds.add(node.id);
      }
    });
    
    // Create a set of all child nodes (nodes that aren't root or parents)
    const allChildNodeIds = new Set<string>();
    
    graphNodes.forEach(node => {
      // If it's not the root and not a parent, it's a child
      if (node.id !== rootNode?.id && !parentNodeIds.has(node.id)) {
        allChildNodeIds.add(node.id);
      }
    });
    
    // Associate each child with its parent(s)
    const childToParentMap: Record<string, Set<string>> = {};
    
    // Initialize for all child nodes
    allChildNodeIds.forEach(childId => {
      childToParentMap[childId] = new Set<string>();
    });
    
    // Populate the child-to-parent map using edges
    graphEdges.forEach(edge => {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // If target is a child node, add source as its parent
      if (allChildNodeIds.has(targetId)) {
        if (parentNodeIds.has(sourceId)) {
          childToParentMap[targetId].add(sourceId);
        }
      }
    });
    
    // Create parent-to-parent connections map to track how parents link to each other
    const parentConnections: Record<string, Set<string>> = {};
    
    // Initialize for all parent nodes
    parentNodeIds.forEach(parentId => {
      parentConnections[parentId] = new Set<string>();
    });
    
    // Populate parent connections map
    graphEdges.forEach(edge => {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // If both source and target are parent nodes, they're connected
      if (parentNodeIds.has(sourceId) && parentNodeIds.has(targetId)) {
        parentConnections[sourceId].add(targetId);
      }
    });
    
    // Find parent nodes directly connected to the root node
    const rootConnectedParents: string[] = [];
    if (rootNode) {
      const rootChildren = directChildrenMap[rootNode.id] || new Set<string>();
      rootChildren.forEach(childId => {
        if (parentNodeIds.has(childId)) {
          rootConnectedParents.push(childId);
        }
      });
    }
    
    // Build parent chains starting from root-connected parents
    const processedParents = new Set<string>();
    const parentChains: string[][] = [];
    
    const buildParentChain = (startParentId: string) => {
      const chain: string[] = [startParentId];
      processedParents.add(startParentId);
      
      // Try to find next connected parent
      let currentParentId = startParentId;
      let foundNext = true;
      
      while (foundNext) {
        foundNext = false;
        
        // Look for any unprocessed parent connected to the current one
        const connectedParents = parentConnections[currentParentId];
        if (connectedParents) {
          for (const nextParentId of connectedParents) {
            if (!processedParents.has(nextParentId)) {
              chain.push(nextParentId);
              processedParents.add(nextParentId);
              currentParentId = nextParentId;
              foundNext = true;
              break;
            }
          }
        }
      }
      
      return chain;
    };
    
    // Process root-connected parents first
    rootConnectedParents.forEach(parentId => {
      if (!processedParents.has(parentId)) {
        const chain = buildParentChain(parentId);
        parentChains.push(chain);
      }
    });
    
    // Process any remaining unprocessed parents
    parentNodeIds.forEach(parentId => {
      if (!processedParents.has(parentId)) {
        const chain = buildParentChain(parentId);
        parentChains.push(chain);
      }
    });
    
    // Flatten all parent chains into a single sequence
    const allParentIds = parentChains.flat();
    
    // Get all parent nodes in the order they should be animated
    const parentNodes = allParentIds.map(parentId => 
      graphNodes.find(node => node.id === parentId)
    ).filter((node): node is Node<FlowNodeData> => node !== undefined);
    
    // For each parent node, find its children
    parentNodes.forEach(parentNode => {
      const parentId = parentNode.id;
      
      // Get all children directly connected to this parent
      const primaryChildren: string[] = [];
      
      allChildNodeIds.forEach(childId => {
        if (childToParentMap[childId].has(parentId)) {
          primaryChildren.push(childId);
        }
      });
      
      // Mark this parent node for animation
      animationMap.set(parentId, {
        nodeId: parentId,
        graphId,
        isParent: true,
        childrenIds: primaryChildren
      });
      
      // Store children to animate for this parent
      childrenToAnimate.current.set(parentId, primaryChildren);
      currentChildIndices.current.set(parentId, -1); // Not yet started
    });
    
    // Mark all child nodes for animation
    allChildNodeIds.forEach(childId => {
      animationMap.set(childId, {
        nodeId: childId,
        graphId,
        isParent: false
      });
    });
    
    // Store the animation map
    setAnimatingNodes(animationMap);
    
    // Initialize the queue of parent nodes
    parentNodeQueue.current = parentNodes.slice(1);
    
    // Start with the first parent node if available
    if (parentNodes.length > 0) {
      const firstParent = parentNodes[0];
      
      // Create animation chain for parent nodes
      activeAnimationChains.current.set('parent', true);
      
      // Start animating the first parent
      setCurrentlyAnimatingNodeIds(new Set([firstParent.id]));
      
      // Update nodes with popups
      setNodesWithPopups([firstParent]);
      
      // For backward compatibility
      setCurrentAnimatingNode(firstParent);
      
      setVisibleNodeIds(prev => {
        const newSet = new Set(prev);
        newSet.add(firstParent.id);
        return newSet;
      });
    } else {
      // No parent nodes, just finish
      setIsAnimating(false);
      setAnimatingGraphId(null);
      
      // Mark graph as visible
      setHiddenGraphIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(graphId);
        return newSet;
      });
    }
  }, [hiddenGraphIds, isAnimating, nodes, edges, setHiddenGraphIds]);

  // Check if animation is complete
  const checkAnimationComplete = useCallback(() => {
    // If there are still active animation chains, we're not done
    if (activeAnimationChains.current.size > 0) return false;
    
    // If parent queue is not empty, we're not done
    if (parentNodeQueue.current.length > 0) return false;
    
    // If there are currently animating nodes, we're not done
    if (currentlyAnimatingNodeIds.size > 0) return false;
    
    // Check that all parents have completed all their children
    for (const [parentId, children] of childrenToAnimate.current.entries()) {
      const currentIndex = currentChildIndices.current.get(parentId) || -1;
      if (currentIndex < children.length - 1) {
        return false;
      }
    }
    
    return true;
  }, [currentlyAnimatingNodeIds]);

  // Handle completion of a single node animation
  const handleNodeAnimationComplete = useCallback((completedNodeId: string) => {
    // Get the completed node's animation data
    const nodeAnimation = animatingNodes.get(completedNodeId);
    if (!nodeAnimation) return;
    
    // Remove this node from currently animating set
    setCurrentlyAnimatingNodeIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(completedNodeId);
      return newSet;
    });
    
    // Remove node from popups array
    removeNodeFromPopups(completedNodeId);
    
    // Keep backward compatibility - clear currentAnimatingNode if it's this node
    if (currentAnimatingNode?.id === completedNodeId) {
      setCurrentAnimatingNode(null);
    }
    
    setTimeout(() => {
      if (nodeAnimation.isParent) {
        // This was a parent node
        completedParentNodes.current.add(completedNodeId);
        
        // Start animating this parent's first child
        const startedChild = startChildAnimation(completedNodeId, 0);
        
        // If no children to animate, remove this parent's child chain
        if (!startedChild) {
          activeAnimationChains.current.delete(`child-${completedNodeId}`);
        }
        
        // Continue with the next parent in the parent chain
        if (parentNodeQueue.current.length > 0) {
          const nextParent = parentNodeQueue.current.shift()!;
          
          // Start animating this parent node
          setCurrentlyAnimatingNodeIds(prev => {
            const newSet = new Set(prev);
            newSet.add(nextParent.id);
            return newSet;
          });
          
          // Add to visible nodes
          setVisibleNodeIds(prev => {
            const newSet = new Set(prev);
            newSet.add(nextParent.id);
            return newSet;
          });
          
          // Add to popups
          addNodeToPopups(nextParent);
          
          // For backward compatibility
          if (currentAnimatingNode === null) {
            setCurrentAnimatingNode(nextParent);
          }
        } else {
          // No more parents to animate
          activeAnimationChains.current.delete('parent');
        }
      } else {
        // This was a child node
        const parentId = findParentId(completedNodeId);
        if (!parentId) return;
        
        // Get the parent's children info
        const children = childrenToAnimate.current.get(parentId) || [];
        const currentIndex = currentChildIndices.current.get(parentId) || 0;
        
        // Move to the next child if any
        if (currentIndex < children.length - 1) {
          startChildAnimation(parentId, currentIndex + 1);
        } else {
          // No more children for this parent
          activeAnimationChains.current.delete(`child-${parentId}`);
        }
      }
      
      // Check if all animations are complete
      setTimeout(() => {
        if (checkAnimationComplete()) {
          // Animation complete
          if (animatingGraphId) {
            setHiddenGraphIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(animatingGraphId);
              return newSet;
            });
          }
          
          setIsAnimating(false);
          setAnimatingGraphId(null);
          setAnimatingNodes(new Map());
          setVisibleNodeIds(new Set());
          setNodesWithPopups([]);
          setCurrentlyAnimatingNodeIds(new Set());
          
          // Reset all reference variables
          childrenToAnimate.current = new Map();
          currentChildIndices.current = new Map();
          completedParentNodes.current = new Set();
          activeAnimationChains.current = new Map();
        }
      }, 100);
    }, 300); // Short delay between animations
  }, [
    animatingNodes, 
    currentAnimatingNode, 
    findParentId, 
    removeNodeFromPopups, 
    startChildAnimation, 
    checkAnimationComplete, 
    animatingGraphId, 
    setHiddenGraphIds,
    addNodeToPopups
  ]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    setAnimatingGraphId(null);
    setAnimatingNodes(new Map());
    setVisibleNodeIds(new Set());
    setCurrentAnimatingNode(null);
    setCurrentlyAnimatingNodeIds(new Set());
    setNodesWithPopups([]);
    
    // Reset all reference variables
    parentNodeQueue.current = [];
    childrenToAnimate.current = new Map();
    currentChildIndices.current = new Map();
    completedParentNodes.current = new Set();
    activeAnimationChains.current = new Map();
  }, []);

  // Filter nodes based on visibility state
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

  // Filter edges based on visibility state
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

  return {
    isAnimating,
    animatingGraphId,
    currentAnimatingNode,
    nodesWithPopups,
    visibleNodeIds,
    filteredNodes,
    filteredEdges,
    startAnimation,
    stopAnimation,
    handleNodeAnimationComplete,
    currentlyAnimatingNodeIds
  };
} 