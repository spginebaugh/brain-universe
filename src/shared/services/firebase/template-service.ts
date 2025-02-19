import { collection, doc, DocumentReference, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Graph } from '@/shared/types/graph';
import { Node } from '@/shared/types/node';
import { Edge } from '@/shared/types/edge';
import { FirestoreService } from './firestore-service';
import { GraphService } from './graph-service';
import { db } from './config';

export class TemplateService extends FirestoreService<Graph> {
  constructor(source: string, subject: string) {
    super(`templates/${source}/${subject}`);
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

  // Template operations
  async createTemplate(template: Graph): Promise<void> {
    await this.create(template.graphId, template);
  }

  async getTemplate(templateId: string): Promise<Graph | null> {
    return this.get(templateId);
  }

  async updateTemplate(templateId: string, data: Partial<Graph>): Promise<void> {
    await this.update(templateId, data);
  }

  // Node operations
  async createNode(templateId: string, node: Node): Promise<void> {
    const nodeRef = this.getNodeRef(templateId, node.nodeId);
    await setDoc(nodeRef, node);
  }

  async getNode(templateId: string, nodeId: string): Promise<Node | null> {
    const nodeRef = this.getNodeRef(templateId, nodeId);
    const docSnap = await getDoc(nodeRef);
    return docSnap.exists() ? (docSnap.data() as Node) : null;
  }

  async updateNode(templateId: string, nodeId: string, data: Partial<Node>): Promise<void> {
    const nodeRef = this.getNodeRef(templateId, nodeId);
    await updateDoc(nodeRef, data);
  }

  // Edge operations
  async createEdge(templateId: string, edge: Edge): Promise<void> {
    const edgeRef = this.getEdgeRef(templateId, edge.edgeId);
    await setDoc(edgeRef, edge);
  }

  async getEdge(templateId: string, edgeId: string): Promise<Edge | null> {
    const edgeRef = this.getEdgeRef(templateId, edgeId);
    const docSnap = await getDoc(edgeRef);
    return docSnap.exists() ? (docSnap.data() as Edge) : null;
  }

  async updateEdge(templateId: string, edgeId: string, data: Partial<Edge>): Promise<void> {
    const edgeRef = this.getEdgeRef(templateId, edgeId);
    await updateDoc(edgeRef, data);
  }

  // Template copying
  async copyTemplateToUserGraph(templateId: string, userId: string, newGraphId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const graphService = new GraphService(userId);
    
    // Copy graph data
    const newGraph: Graph = {
      ...template,
      graphId: newGraphId,
      metadata: {
        ...template.metadata,
        fromTemplate: true,
        templateId: templateId
      }
    };
    await graphService.createGraph(newGraph);

    // Copy nodes
    const nodesSnapshot = await getDocs(this.getNodesCollection(templateId));
    for (const nodeDoc of nodesSnapshot.docs) {
      const node = nodeDoc.data() as Node;
      await graphService.createNode(newGraphId, node);
    }

    // Copy edges
    const edgesSnapshot = await getDocs(this.getEdgesCollection(templateId));
    for (const edgeDoc of edgesSnapshot.docs) {
      const edge = edgeDoc.data() as Edge;
      await graphService.createEdge(newGraphId, edge);
    }
  }
} 