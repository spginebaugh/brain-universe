import { collection, doc, DocumentReference, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Graph } from '@/shared/types/graph';
import { Node } from '@/shared/types/node';
import { Edge } from '@/shared/types/edge';
import { FirestoreService } from './firestore-service';
import { db } from './config';

export class GraphService extends FirestoreService<Graph> {
  constructor(userId: string) {
    super(`users/${userId}/graphs`);
  }

  protected getNodesCollection(graphId: string) {
    return collection(db, this.collectionPath, graphId, 'nodes');
  }

  protected getEdgesCollection(graphId: string) {
    return collection(db, this.collectionPath, graphId, 'edges');
  }

  protected getNodeRef(graphId: string, nodeId: string): DocumentReference {
    return doc(this.getNodesCollection(graphId), nodeId);
  }

  protected getEdgeRef(graphId: string, edgeId: string): DocumentReference {
    return doc(this.getEdgesCollection(graphId), edgeId);
  }

  // Graph operations
  async createGraph(graph: Graph): Promise<void> {
    await this.create(graph.graphId, graph);
  }

  async getGraph(graphId: string): Promise<Graph | null> {
    return this.get(graphId);
  }

  async updateGraph(graphId: string, data: Partial<Graph>): Promise<void> {
    await this.update(graphId, data);
  }

  // Node operations
  async createNode(graphId: string, node: Node): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, node.nodeId);
    await setDoc(nodeRef, node);
  }

  async getNode(graphId: string, nodeId: string): Promise<Node | null> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    const docSnap = await getDoc(nodeRef);
    return docSnap.exists() ? (docSnap.data() as Node) : null;
  }

  async updateNode(graphId: string, nodeId: string, data: Partial<Node>): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    await updateDoc(nodeRef, data);
  }

  async deleteNode(graphId: string, nodeId: string): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    await deleteDoc(nodeRef);
  }

  // Edge operations
  async createEdge(graphId: string, edge: Edge): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edge.edgeId);
    await setDoc(edgeRef, edge);
  }

  async getEdge(graphId: string, edgeId: string): Promise<Edge | null> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    const docSnap = await getDoc(edgeRef);
    return docSnap.exists() ? (docSnap.data() as Edge) : null;
  }

  async updateEdge(graphId: string, edgeId: string, data: Partial<Edge>): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    await updateDoc(edgeRef, data);
  }

  async deleteEdge(graphId: string, edgeId: string): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    await deleteDoc(edgeRef);
  }
} 