import { collection, doc, DocumentReference, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { FirestoreService } from './firestore-service';
import { db } from './config';
import { TemplateGraph, TemplateNode, TemplateEdge } from '@/shared/types/template-types';
import { DbGraph, DbNode, DbEdge } from '@/shared/types/db-types';
import { Graph } from '@/shared/types/graph';
import { Node } from '@/shared/types/node';
import { Edge } from '@/shared/types/edge';
import { GraphService } from './graph-service';

export interface CopyTemplateOptions {
  templateId: string;
  userId: string;
  newGraphId: string;
  graphPosition?: { x: number; y: number };
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
    graphPosition = { x: 0, y: 0 },
  }: CopyTemplateOptions): Promise<void> {
    console.log('Starting template copy process...', { templateId, userId, newGraphId });
    
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    console.log('Found template:', template);

    const graphService = new GraphService(userId);
    
    const baseGraph: Graph = template as unknown as Graph;
    const newGraph: DbGraph = {
      ...baseGraph,
      graphId: newGraphId,
      graphPosition,
    } as DbGraph;

    console.log('Creating new graph:', newGraph);
    await graphService.createGraph(newGraph);

    // Copy nodes
    console.log('Copying nodes...');
    const nodesSnapshot = await getDocs(this.getNodesCollection(templateId));
    console.log(`Found ${nodesSnapshot.docs.length} nodes to copy`);
    
    const nodeCopyPromises = nodesSnapshot.docs.map(async (nodeDoc) => {
      const baseNode: Node = nodeDoc.data() as unknown as Node;
      const newNode: DbNode = baseNode as DbNode;
      console.log('Copying node:', newNode.nodeId);
      return graphService.createNode(newGraphId, newNode);
    });
    await Promise.all(nodeCopyPromises);
    console.log('Finished copying nodes');

    // Copy edges
    console.log('Copying edges...');
    const edgesSnapshot = await getDocs(this.getEdgesCollection(templateId));
    console.log(`Found ${edgesSnapshot.docs.length} edges to copy`);
    
    const edgeCopyPromises = edgesSnapshot.docs.map(async (edgeDoc) => {
      const baseEdge: Edge = edgeDoc.data() as unknown as Edge;
      const newEdge: DbEdge = baseEdge as DbEdge;
      console.log('Copying edge:', newEdge.edgeId);
      return graphService.createEdge(newGraphId, newEdge);
    });
    await Promise.all(edgeCopyPromises);
    console.log('Finished copying edges');
    
    console.log('Template copy process completed successfully');
  }

  async getAll(): Promise<TemplateGraph[]> {
    const snapshot = await getDocs(collection(db, this.collectionPath));
    return snapshot.docs.map(doc => doc.data() as TemplateGraph);
  }
} 