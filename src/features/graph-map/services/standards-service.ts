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
  visibleNodes: Set<string>,
  nodePositions: Map<string, { x: number; y: number }>
): GraphData => {
  const standards = standardsData.data.standards;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const processedNodes = new Set<string>();

  // Create nodes with positions from the store
  Array.from(visibleNodes).forEach(id => {
    const standard = standards[id];
    const position = nodePositions.get(id);
    
    if (!processedNodes.has(id) && standard && position) {
      nodes.push({
        id,
        data: {
          label: standard.description,
          depth: standard.depth,
        },
        position,
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