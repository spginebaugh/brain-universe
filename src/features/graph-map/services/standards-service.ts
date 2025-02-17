import { StandardsData, Standard } from '../types/standard';

interface GraphNode {
  id: string;
  data: {
    label: string;
    depth: number;
  };
  position: { x: number; y: number };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const fetchStandardsData = async (): Promise<StandardsData> => {
  const response = await fetch('/texas_math_standardsasassay_false.json');
  return response.json();
};

export const transformToGraphData = (
  standardsData: StandardsData,
  visibleNodes: Set<string>
): GraphData => {
  const standards = standardsData.data.standards;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const processedNodes = new Set<string>();

  // First, find all level 1 nodes that are visible
  const visibleLevel1Nodes = Object.values(standards)
    .filter(standard => standard.depth === 1 && visibleNodes.has(standard.id));

  // Calculate horizontal offset for each subtree
  const SUBTREE_HORIZONTAL_SPACING = 1000; // Space between different subtrees
  const DEPTH_HORIZONTAL_SPACING = 300; // Space between depths within a subtree
  
  // Create nodes with updated positioning
  Array.from(visibleNodes).forEach(id => {
    const standard = standards[id];
    if (!processedNodes.has(id) && standard) {
      // Find which subtree this node belongs to
      const parentLevel1Node = visibleLevel1Nodes.find(level1Node => 
        standard.ancestorIds.includes(level1Node.id) || standard.id === level1Node.id
      );
      
      // Calculate x position based on subtree index and depth
      const subtreeIndex = parentLevel1Node ? 
        visibleLevel1Nodes.indexOf(parentLevel1Node) : 0;
      
      nodes.push({
        id,
        data: {
          label: standard.description,
          depth: standard.depth,
        },
        position: { 
          x: (subtreeIndex * SUBTREE_HORIZONTAL_SPACING) + (standard.depth * DEPTH_HORIZONTAL_SPACING),
          y: standard.position / 1000,
        },
      });
      processedNodes.add(id);
    }
  });

  // Create edges only between visible nodes
  const nodeIds = new Set(nodes.map(node => node.id));
  
  Array.from(visibleNodes).forEach(id => {
    const standard = standards[id];
    if (standard) {
      // Find the direct parent (ancestor with highest depth less than current node)
      const directParent = standard.ancestorIds
        .filter(ancestorId => visibleNodes.has(ancestorId))
        .map(ancestorId => standards[ancestorId])
        .filter((ancestor): ancestor is Standard => 
          ancestor !== undefined && ancestor.depth < standard.depth
        )
        .reduce<Standard | null>((closest, current) => {
          if (!closest || (current.depth > closest.depth)) {
            return current;
          }
          return closest;
        }, null);

      // Create edge only to direct parent if it exists
      if (directParent && nodeIds.has(directParent.id)) {
        edges.push({
          id: `${directParent.id}-${standard.id}`,
          source: directParent.id,
          target: standard.id,
        });
      }
    }
  });

  return { nodes, edges };
};

export type { GraphData, GraphNode, GraphEdge }; 