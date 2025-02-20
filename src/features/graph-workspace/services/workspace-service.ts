import { FirestoreService } from '@/shared/services/firebase/firestore-service';
import type { Graph } from '@/shared/types/graph';
import type { Node } from '@/shared/types/node';
import type { FlowGraph, FlowNode, WorkspacePosition } from '../types/workspace-types';

export class WorkspaceService {
  private graphService: FirestoreService<Graph>;
  private nodeService: FirestoreService<Node>;
  private graphId: string;

  constructor(userId: string, graphId: string) {
    this.graphId = graphId;
    this.graphService = new FirestoreService<Graph>(`users/${userId}/graphs`);
    this.nodeService = new FirestoreService<Node>(`users/${userId}/graphs/${graphId}/nodes`);
  }

  private calculateDisplayPosition(node: Node, graph: Graph): WorkspacePosition {
    return {
      x: graph.graphPosition.x + node.nodePosition.x,
      y: graph.graphPosition.y + node.nodePosition.y
    };
  }

  private transformToFlowGraph(graph: Graph, nodes: Node[]): FlowGraph {
    const flowNodes: FlowNode[] = nodes.map(node => ({
      ...node,
      id: node.nodeId,
      type: 'default',
      displayPosition: this.calculateDisplayPosition(node, graph)
    }));

    return {
      ...graph,
      nodes: flowNodes,
      edges: [] // We'll implement edge fetching later
    };
  }

  async fetchWorkspaceData(): Promise<FlowGraph> {
    const graph = await this.graphService.get(this.graphId);
    if (!graph) throw new Error('Graph not found');

    const nodes = await this.nodeService.list();
    
    return this.transformToFlowGraph(graph, nodes);
  }
} 