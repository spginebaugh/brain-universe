import { collection, doc, DocumentReference, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FirestoreService } from './firestore-service';
import { db } from './config';
import { DbGraph, DbNode, DbEdge } from '@/shared/types/db-types';
import { TemplateGraph, TemplateNode, TemplateEdge } from '@/shared/types/template-types';

export class GraphService extends FirestoreService<DbGraph> {
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
  async createGraph(graph: TemplateGraph | DbGraph): Promise<void> {
    await this.create(graph.graphId, graph as DbGraph);
  }

  async getGraph(graphId: string): Promise<DbGraph | null> {
    return this.get(graphId);
  }

  async updateGraph(graphId: string, data: Partial<DbGraph>): Promise<void> {
    await this.update(graphId, data);
  }

  // Node operations
  async createNode(graphId: string, node: TemplateNode | DbNode): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, node.nodeId);
    await setDoc(nodeRef, node as DbNode);
  }

  async getNode(graphId: string, nodeId: string): Promise<DbNode | null> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    const docSnap = await getDoc(nodeRef);
    return docSnap.exists() ? (docSnap.data() as DbNode) : null;
  }

  async updateNode(graphId: string, nodeId: string, data: Partial<DbNode>): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    await updateDoc(nodeRef, data);
  }

  async deleteNode(graphId: string, nodeId: string): Promise<void> {
    const nodeRef = this.getNodeRef(graphId, nodeId);
    await deleteDoc(nodeRef);
  }

  // Edge operations
  async createEdge(graphId: string, edge: TemplateEdge | DbEdge): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edge.edgeId);
    await setDoc(edgeRef, edge as DbEdge);
  }

  async getEdge(graphId: string, edgeId: string): Promise<DbEdge | null> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    const docSnap = await getDoc(edgeRef);
    return docSnap.exists() ? (docSnap.data() as DbEdge) : null;
  }

  async updateEdge(graphId: string, edgeId: string, data: Partial<DbEdge>): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    await updateDoc(edgeRef, data);
  }

  async deleteEdge(graphId: string, edgeId: string): Promise<void> {
    const edgeRef = this.getEdgeRef(graphId, edgeId);
    await deleteDoc(edgeRef);
  }
} 