import { BaseStandard } from '../types';
import { Graph, Node, Edge, GraphPosition, NodePosition } from '../types/firebase-types';
import { v4 as uuidv4 } from 'uuid';

interface FirebaseOutput {
  graphs: Graph[];
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_GRAPH_POSITION: GraphPosition = { x: 0, y: 0 };
const DEFAULT_NODE_POSITION: NodePosition = { x: 0, y: 0 };

function createGraphForStandard(
  rootStandard: BaseStandard,
  descendants: BaseStandard[],
  source: string,
  subjectName: string
): Graph {
  return {
    graphId: uuidv4(),
    rootNodeId: rootStandard.id,
    subjectName: subjectName,
    graphName: `${rootStandard.nodeTitle}`,
    properties: {
      description: rootStandard.nodeDescription || '',
      type: 'curriculum',
      status: 'active'
    },
    metadata: {
      fromTemplate: true,
      templateId: `${source}-${subjectName}-${rootStandard.nodeTitle}`,
      tags: [source, subjectName, 'standards', `depth_${rootStandard.metadata.depth}`]
    },
    progress: {
      completedNodes: 0,
      milestones: {}
    },
    settings: {
      progressTracking: true,
      displayOptions: {
        layout: 'tree',
        showProgress: true
      }
    },
    graphPosition: DEFAULT_GRAPH_POSITION
  };
}

function createNodeFromStandard(standard: BaseStandard, source: string, subjectName: string): Node {
  return {
    nodeId: standard.id,
    properties: {
      title: standard.nodeTitle,
      description: standard.nodeDescription,
      type: 'standard'
    },
    metadata: {
      status: 'active',
      tags: [
        source,
        subjectName,
        `depth_${standard.metadata.depth}`,
        standard.metadata.standardNotation
      ],
    },
    content: {
      mainText: standard.nodeDescription,
      sections: {
        notation: {
          title: 'Standard Notation',
          content: standard.metadata.standardNotation
        }
      }
    },
    nodePosition: DEFAULT_NODE_POSITION
  };
}

export function convertToFirebaseFormat(standards: BaseStandard[]): FirebaseOutput {
  // Sort by depth to ensure proper parent-child relationships
  const filteredStandards = standards.sort((a, b) => a.metadata.depth - b.metadata.depth);

  if (filteredStandards.length === 0) {
    throw new Error('No standards found');
  }

  const source = filteredStandards[0].metadata.source;
  const subjectName = filteredStandards[0].metadata.subjectName;

  // Group nodes by depth
  const nodesByDepth = new Map<number, BaseStandard[]>();
  filteredStandards.forEach(standard => {
    const depth = standard.metadata.depth;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth)!.push(standard);
  });

  // Get depth 0 nodes (these will be our root nodes for separate graphs)
  const rootNodes = nodesByDepth.get(0) || [];
  const graphs: Graph[] = [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Process each depth 0 node and its descendants
  rootNodes.forEach(rootNode => {
    // Find all descendants of this root node
    const descendants = filteredStandards.filter(standard => {
      if (standard.id === rootNode.id) return false;
      
      // Check if this node is a descendant by traversing up through parent IDs
      let current = standard;
      while (current && current.relationships.parentIds.length > 0) {
        if (current.relationships.parentIds.includes(rootNode.id)) {
          return true;
        }
        // Find the parent with the smallest depth
        const parents = current.relationships.parentIds
          .map(id => filteredStandards.find(s => s.id === id))
          .filter((s): s is BaseStandard => s !== undefined)
          .sort((a, b) => a.metadata.depth - b.metadata.depth);
        
        if (parents.length === 0) break;
        current = parents[0];
      }
      return false;
    });

    // Create graph for this root node and its descendants
    const graph = createGraphForStandard(rootNode, descendants, source, subjectName);
    graphs.push(graph);

    // Create nodes
    nodes.push(createNodeFromStandard(rootNode, source, subjectName));
    descendants.forEach(descendant => {
      nodes.push(createNodeFromStandard(descendant, source, subjectName));
    });

    // Create edges for this subgraph
    const subgraphNodes = [rootNode, ...descendants];
    subgraphNodes.forEach(standard => {
      const currentDepth = standard.metadata.depth;
      const parentDepth = currentDepth - 1;
      
      const potentialParents = subgraphNodes.filter(n => n.metadata.depth === parentDepth);
      const directParentIds = standard.relationships.parentIds.filter(parentId => 
        potentialParents.some(parent => parent.id === parentId)
      );

      directParentIds.forEach(parentId => {
        edges.push({
          edgeId: uuidv4(),
          fromNodeId: parentId,
          toNodeId: standard.id,
          isDirected: true,
          relationshipType: 'tree_edge'
        });
      });
    });
  });

  return {
    graphs,
    nodes,
    edges
  };
} 