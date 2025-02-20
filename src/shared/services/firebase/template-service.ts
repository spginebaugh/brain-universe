import { collection, doc, DocumentReference, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { FirestoreService } from './firestore-service';
import { db } from './config';
import { TemplateGraph, TemplateNode, TemplateEdge } from '@/shared/types/template-types';
import { DbGraph, DbNode, DbEdge } from '@/shared/types/db-types';
import { Graph } from '@/shared/types/graph';
import { Node } from '@/shared/types/node';
import { Edge } from '@/shared/types/edge';
import { GraphService } from './graph-service';

interface CopyTemplateOptions {
  templateId: string;
  userId: string;
  newGraphId: string;
}

export class TemplateService extends FirestoreService<TemplateGraph> {
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
  async createTemplate(template: TemplateGraph): Promise<void> {
    await this.create(template.graphId, template);
  }

  async getTemplate(templateId: string): Promise<TemplateGraph | null> {
    return this.get(templateId);
  }

  async updateTemplate(templateId: string, data: Partial<TemplateGraph>): Promise<void> {
    await this.update(templateId, data);
  }

  // Node operations
  async createNode(templateId: string, node: TemplateNode): Promise<void> {
    const nodeRef = this.getNodeRef(templateId, node.nodeId);
    await setDoc(nodeRef, node);
  }

  async getNode(templateId: string, nodeId: string): Promise<TemplateNode | null> {
    const nodeRef = this.getNodeRef(templateId, nodeId);
    const docSnap = await getDoc(nodeRef);
    return docSnap.exists() ? (docSnap.data() as TemplateNode) : null;
  }

  async updateNode(templateId: string, nodeId: string, data: Partial<TemplateNode>): Promise<void> {
    const nodeRef = this.getNodeRef(templateId, nodeId);
    await updateDoc(nodeRef, data);
  }

  // Edge operations
  async createEdge(templateId: string, edge: TemplateEdge): Promise<void> {
    const edgeRef = this.getEdgeRef(templateId, edge.edgeId);
    await setDoc(edgeRef, edge);
  }

  async getEdge(templateId: string, edgeId: string): Promise<TemplateEdge | null> {
    const edgeRef = this.getEdgeRef(templateId, edgeId);
    const docSnap = await getDoc(edgeRef);
    return docSnap.exists() ? (docSnap.data() as TemplateEdge) : null;
  }

  async updateEdge(templateId: string, edgeId: string, data: Partial<TemplateEdge>): Promise<void> {
    const edgeRef = this.getEdgeRef(templateId, edgeId);
    await updateDoc(edgeRef, data);
  }

  // Template copying
  async copyTemplateToUserGraph({
    templateId,
    userId,
    newGraphId,
  }: CopyTemplateOptions): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const graphService = new GraphService(userId);
    
    // The actual data stored in Firestore is identical between template and database
    // Only the TypeScript types are different for code organization
    // So we can safely cast the raw data to the base type, then to the target type
    const baseGraph: Graph = template as unknown as Graph;
    const newGraph: DbGraph = {
      ...baseGraph,
      graphId: newGraphId
    } as DbGraph;

    await graphService.createGraph(newGraph);

    // Copy nodes (same principle - the stored data is identical)
    const nodesSnapshot = await getDocs(this.getNodesCollection(templateId));
    for (const nodeDoc of nodesSnapshot.docs) {
      const baseNode: Node = nodeDoc.data() as unknown as Node;
      const newNode: DbNode = baseNode as DbNode;
      await graphService.createNode(newGraphId, newNode);
    }

    // Copy edges (same principle - the stored data is identical)
    const edgesSnapshot = await getDocs(this.getEdgesCollection(templateId));
    for (const edgeDoc of edgesSnapshot.docs) {
      const baseEdge: Edge = edgeDoc.data() as unknown as Edge;
      const newEdge: DbEdge = baseEdge as DbEdge;
      await graphService.createEdge(newGraphId, newEdge);
    }
  }

  async getAll(): Promise<TemplateGraph[]> {
    const snapshot = await getDocs(collection(db, this.collectionPath));
    return snapshot.docs.map(doc => doc.data() as TemplateGraph);
  }
} 