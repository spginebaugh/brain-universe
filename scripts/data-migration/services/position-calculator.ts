import { createGeometryService } from '../../../src/features/graph-workspace/services/geometry/geometry';
import { GraphPosition, NodePosition } from '../types/firebase-types';

const geometryService = createGeometryService();

interface NodeWithPosition {
  nodeId: string;
  parentId: string | null;
  nodePosition: NodePosition;
  level: number;
}

export const calculateNodePositions = (nodes: NodeWithPosition[]): NodeWithPosition[] => {
  // Constants for layout
  const LEVEL_RADIUS = 200; // Base radius for each level

  // Find root node (node with no parent)
  const rootNode = nodes.find(node => !node.parentId);
  if (!rootNode) throw new Error('No root node found');

  // Set root node position to 0,0
  rootNode.nodePosition = { x: 0, y: 0 };

  // Group nodes by level
  const nodesByLevel = nodes.reduce((acc, node) => {
    if (!acc[node.level]) acc[node.level] = [];
    acc[node.level].push(node);
    return acc;
  }, {} as Record<number, NodeWithPosition[]>);

  // Calculate positions level by level
  Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
    if (level === '0') return; // Skip root level

    const radius = LEVEL_RADIUS * parseInt(level);
    const positions = geometryService.calculateCircularPositions(
      { x: 0, y: 0 }, // Center (relative to root)
      radius,
      levelNodes.length
    );

    // Assign positions to nodes
    levelNodes.forEach((node, index) => {
      node.nodePosition = positions[index];
    });
  });

  return nodes;
};

export const calculateGraphPosition = (): GraphPosition => {
  // Default graph position - will be modified when instantiated for a user
  return { x: 0, y: 0 };
}; 