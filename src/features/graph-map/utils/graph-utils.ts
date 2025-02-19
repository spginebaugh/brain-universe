import { StandardsData } from '../types/standard';
import { auth } from '@/shared/services/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/config';

export const getAllChildNodes = async (nodeId: string, standardsData: StandardsData): Promise<string[]> => {
  if (!auth?.currentUser || standardsData.data.id === 'empty') {
    return [];
  }

  // Get all edges for the graph
  const edgesRef = collection(
    db, 
    `users/${auth.currentUser.uid}/graphs/${standardsData.data.id}/edges`
  );
  
  const edgesSnapshot = await getDocs(edgesRef);
  const childNodes = new Set<string>();

  // Create an adjacency list for faster traversal
  const adjacencyList = new Map<string, string[]>();
  edgesSnapshot.forEach(doc => {
    const edge = doc.data();
    const children = adjacencyList.get(edge.fromNodeId) || [];
    children.push(edge.toNodeId);
    adjacencyList.set(edge.fromNodeId, children);
  });

  // DFS function to collect all descendants
  const collectDescendants = (currentNodeId: string) => {
    const children = adjacencyList.get(currentNodeId) || [];
    children.forEach(childId => {
      childNodes.add(childId);
      collectDescendants(childId);
    });
  };

  // Start DFS from the given node
  collectDescendants(nodeId);

  return Array.from(childNodes);
}; 