import { FirestoreService } from '@/shared/services/firebase/firestore-service';
import type { Graph } from '@/shared/types/graph';
import type { Node as BaseNode } from '@/shared/types/node';
import type { Edge as BaseEdge } from '@/shared/types/edge';
import type { FlowGraph, FlowNode, FlowEdge, WorkspacePosition } from '../types/workspace-types';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/config';

export class WorkspaceService {
  private graphService: FirestoreService<Graph>;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.graphService = new FirestoreService<Graph>(`users/${userId}/graphs`);
  }

  private calculateNodePosition(node: BaseNode, graph: Graph): WorkspacePosition {
    const graphPosition = graph.graphPosition || { x: 0, y: 0 };
    const nodePosition = node.nodePosition || { x: 0, y: 0 };
    
    return {
      x: graphPosition.x + nodePosition.x,
      y: graphPosition.y + nodePosition.y
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

  /**
   * Subscribe to real-time updates for all graphs and their nodes/edges
   * @param callback Function to call when graphs are updated
   * @returns Unsubscribe function to clean up listeners
   */
  subscribeToGraphs(callback: (graphs: FlowGraph[]) => void): () => void {
    // Get a reference to the graphs collection
    const graphsRef = collection(db, `users/${this.userId}/graphs`);
    const graphsQuery = query(graphsRef);
    
    // Track all active subscriptions to clean up later
    const subscriptions: (() => void)[] = [];
    
    // Primary subscription for graph documents
    const unsubscribeGraphs = onSnapshot(graphsQuery, async (graphsSnapshot) => {
      try {
        // If there are no graphs, call the callback with an empty array
        if (graphsSnapshot.empty) {
          callback([]);
          return;
        }
        
        // Transform graphs to FlowGraphs and setup child listeners
        const graphs: Graph[] = [];
        graphsSnapshot.forEach(doc => {
          const graph = doc.data() as Graph;
          graphs.push(graph);
        });
        
        // Cancel any previous subscriptions to nodes/edges
        while (subscriptions.length > 0) {
          const unsub = subscriptions.pop();
          if (unsub) unsub();
        }
        
        // Setup subscriptions for each graph's nodes and edges
        const flowGraphsPromises = graphs.map(async (graph) => {
          const flowGraph = await this.setupGraphSubscriptions(graph, callback, subscriptions);
          return flowGraph;
        });
        
        // Wait for all graph transformations and send update
        const flowGraphs = await Promise.all(flowGraphsPromises);
        callback(flowGraphs);
      } catch (error) {
        console.error('Error in graph subscription:', error);
      }
    });
    
    // Return a function that unsubscribes from everything
    return () => {
      unsubscribeGraphs();
      // Clean up all node/edge subscriptions
      subscriptions.forEach(unsub => unsub());
    };
  }
  
  /**
   * Setup subscriptions for a specific graph's nodes and edges
   * @param graph The graph to subscribe to
   * @param callback The main callback to trigger when data changes
   * @param subscriptions Array to track active subscriptions
   * @returns The transformed FlowGraph
   */
  private async setupGraphSubscriptions(
    graph: Graph, 
    callback: (graphs: FlowGraph[]) => void,
    subscriptions: (() => void)[]
  ): Promise<FlowGraph> {
    // Initial transform without subscriptions
    const initialFlowGraph = await this.transformToFlowGraph(graph);
    
    // Setup node subscription
    const nodesRef = collection(db, `users/${this.userId}/graphs/${graph.graphId}/nodes`);
    const nodesQuery = query(nodesRef);
    const unsubNodes = onSnapshot(nodesQuery, async () => {
      // When nodes change, refresh all graphs
      const updatedGraphs = await this.fetchAllGraphs();
      callback(updatedGraphs);
    });
    subscriptions.push(unsubNodes);
    
    // Setup edge subscription
    const edgesRef = collection(db, `users/${this.userId}/graphs/${graph.graphId}/edges`);
    const edgesQuery = query(edgesRef);
    const unsubEdges = onSnapshot(edgesQuery, async () => {
      // When edges change, refresh all graphs
      const updatedGraphs = await this.fetchAllGraphs();
      callback(updatedGraphs);
    });
    subscriptions.push(unsubEdges);
    
    return initialFlowGraph;
  }
} 