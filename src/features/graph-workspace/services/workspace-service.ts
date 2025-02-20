import { FirestoreService } from '@/shared/services/firebase/firestore-service';
import type { Graph } from '@/shared/types/graph';
import type { Node as BaseNode } from '@/shared/types/node';
import type { Edge as BaseEdge } from '@/shared/types/edge';
import type { FlowGraph, FlowNode, FlowEdge, WorkspacePosition } from '../types/workspace-types';

export class WorkspaceService {
  private graphService: FirestoreService<Graph>;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.graphService = new FirestoreService<Graph>(`users/${userId}/graphs`);
  }

  private calculateNodePosition(node: BaseNode, graph: Graph): WorkspacePosition {
    // Calculate absolute position by adding graph position to node's relative position
    return {
      x: (graph.graphPosition?.x || 0) + (node.nodePosition?.x || 0),
      y: (graph.graphPosition?.y || 0) + (node.nodePosition?.y || 0)
    };
  }

  private transformToFlowNode(node: BaseNode, graph: Graph): FlowNode {
    const position = this.calculateNodePosition(node, graph);
    return {
      id: node.nodeId,
      type: 'default',
      position,
      data: {
        label: node.properties.title,
        description: node.properties.description,
        status: node.metadata.status,
        graphId: graph.graphId,
        graphName: graph.graphName,
        properties: node.properties,
        metadata: node.metadata,
        progress: node.progress,
        content: node.content,
        extensions: node.extensions
      }
    };
  }

  private transformToFlowEdge(edge: BaseEdge, graph: Graph): FlowEdge {
    return {
      id: edge.edgeId,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'step',
      data: {
        graphId: graph.graphId,
        properties: {
          type: edge.relationshipType,
          status: 'active'
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    };
  }

  private async fetchGraphNodes(graphId: string): Promise<BaseNode[]> {
    const nodeService = new FirestoreService<BaseNode>(`users/${this.userId}/graphs/${graphId}/nodes`);
    return nodeService.list();
  }

  private async fetchGraphEdges(graphId: string): Promise<BaseEdge[]> {
    const edgeService = new FirestoreService<BaseEdge>(`users/${this.userId}/graphs/${graphId}/edges`);
    return edgeService.list();
  }

  private async transformToFlowGraph(graph: Graph): Promise<FlowGraph> {
    // Fetch nodes and edges in parallel
    const [nodes, edges] = await Promise.all([
      this.fetchGraphNodes(graph.graphId),
      this.fetchGraphEdges(graph.graphId)
    ]);

    return {
      ...graph,
      nodes: nodes.map(node => ({
        ...node,
        position: this.calculateNodePosition(node, graph)
      })),
      edges
    };
  }

  async fetchAllGraphs(): Promise<FlowGraph[]> {
    try {
      const graphs = await this.graphService.list();
      if (!graphs.length) {
        return [];
      }

      // Transform all graphs in parallel
      const flowGraphs = await Promise.all(
        graphs.map(graph => this.transformToFlowGraph(graph))
      );

      return flowGraphs;
    } catch (error) {
      console.error('Error fetching graphs:', error);
      throw error;
    }
  }
} 