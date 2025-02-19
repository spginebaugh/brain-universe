import { StandardsData, Standard } from '../types/standard';
import { Position } from '../types/graph';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { auth } from '@/shared/services/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/config';
import { Node } from '@/shared/types/node';

interface GraphNode {
  id: string;
  data: {
    label: string;
    title: string;
    depth: number;
  };
  position: Position;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Helper function to calculate node depths based on edge relationships
const calculateNodeDepths = (
  rootNodeId: string,
  nodes: Record<string, Node>,
  edges: Record<string, { fromNodeId: string; toNodeId: string }>
): Map<string, number> => {
  const depths = new Map<string, number>();
  const visited = new Set<string>();
  
  // Create adjacency list for faster traversal
  const adjacencyList = new Map<string, string[]>();
  Object.values(edges).forEach(edge => {
    const children = adjacencyList.get(edge.fromNodeId) || [];
    children.push(edge.toNodeId);
    adjacencyList.set(edge.fromNodeId, children);
  });

  // DFS function to calculate depths
  const calculateDepth = (nodeId: string, currentDepth: number) => {
    if (visited.has(nodeId)) return;
    
    visited.add(nodeId);
    depths.set(nodeId, currentDepth);
    
    const children = adjacencyList.get(nodeId) || [];
    children.forEach(childId => {
      calculateDepth(childId, currentDepth + 1);
    });
  };

  // Start DFS from root node
  calculateDepth(rootNodeId, 0);

  // Handle any disconnected nodes
  Object.keys(nodes).forEach(nodeId => {
    if (!depths.has(nodeId)) {
      depths.set(nodeId, 0);
    }
  });

  return depths;
};

export const fetchStandardsData = async (): Promise<StandardsData> => {
  if (!auth?.currentUser) {
    throw new Error('User must be authenticated to fetch standards data');
  }

  const graphService = new GraphService(auth.currentUser.uid);
  const graphs = await graphService.list();
  
  // For now, we'll just use the first graph if it exists
  const graph = graphs[0];
  if (!graph) {
    return {
      data: {
        id: 'empty',
        title: 'No Graphs Available',
        subject: 'math',
        normalizedSubject: 'math',
        educationLevels: [],
        standards: {}
      }
    };
  }

  // Fetch all nodes and edges for this graph
  const nodesRef = collection(db, `users/${auth.currentUser.uid}/graphs/${graph.graphId}/nodes`);
  const edgesRef = collection(db, `users/${auth.currentUser.uid}/graphs/${graph.graphId}/edges`);
  
  const [nodesSnapshot, edgesSnapshot] = await Promise.all([
    getDocs(nodesRef),
    getDocs(edgesRef)
  ]);
  
  // Create node and edge maps
  const nodes: Record<string, Node> = {};
  const edges: Record<string, { fromNodeId: string; toNodeId: string }> = {};
  
  nodesSnapshot.forEach(doc => {
    const node = doc.data() as Node;
    nodes[node.nodeId] = node;
  });

  edgesSnapshot.forEach(doc => {
    const edge = doc.data();
    edges[edge.edgeId] = {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId
    };
  });

  // Calculate depths based on edge relationships
  const nodeDepths = calculateNodeDepths(graph.rootNodeId, nodes, edges);
  
  // Create standards record
  const standards: Record<string, Standard> = {};
  
  Object.entries(nodes).forEach(([nodeId, node]) => {
    standards[nodeId] = {
      id: nodeId,
      asnIdentifier: nodeId,
      position: 0,
      description: node.properties?.title || '',
      depth: nodeDepths.get(nodeId) || 0,
      ancestorIds: [], // No longer used, but kept for type compatibility
    };
  });

  return {
    data: {
      id: graph.graphId,
      title: graph.graphName,
      subject: graph.subjectName,
      normalizedSubject: graph.subjectName.toLowerCase(),
      educationLevels: [],
      standards
    }
  };
};

export const transformToGraphData = async (
  standardsData: StandardsData,
  visibleNodes: Set<string>,
  nodePositions: Map<string, Position>
): Promise<GraphData> => {
  const standards = standardsData.data.standards;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const processedNodes = new Set<string>();

  // Create nodes with positions from the store
  Array.from(visibleNodes).forEach(id => {
    const standard = standards[id];
    const position = nodePositions.get(id);
    
    if (!processedNodes.has(id) && standard && position) {
      nodes.push({
        id,
        data: {
          label: standard.description,
          title: standard.description,
          depth: standard.depth,
        },
        position,
      });
      processedNodes.add(id);
    }
  });

  // Fetch edges for the visible nodes
  if (auth?.currentUser && standardsData.data.id !== 'empty') {
    const edgesRef = collection(
      db, 
      `users/${auth.currentUser.uid}/graphs/${standardsData.data.id}/edges`
    );
    
    const edgesSnapshot = await getDocs(edgesRef);
    edgesSnapshot.forEach(doc => {
      const edge = doc.data();
      if (visibleNodes.has(edge.fromNodeId) && visibleNodes.has(edge.toNodeId)) {
        edges.push({
          id: edge.edgeId,
          source: edge.fromNodeId,
          target: edge.toNodeId,
        });
      }
    });
  }

  return { nodes, edges };
};

export type { GraphData, GraphNode, GraphEdge }; 