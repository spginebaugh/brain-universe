import { fetchTexasMathStandards } from './services/api';
import { processTexasApiStandards } from './processors/texas-math-api';
import { convertToFirebaseFormat } from './processors/firebase-format';
import { validateStandard } from './validation';
import { calculateNodePositions, calculateGraphPosition } from './services/position-calculator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseStandard } from './types';

async function importTexasStandards() {
  try {
    console.log('Fetching Texas Math Standards from API...');
    
    // Fetch standards from API
    const apiResponse = await fetchTexasMathStandards();
    
    // Process the API response
    const standards = processTexasApiStandards(apiResponse);
    
    console.log(`Processing ${standards.length} standards...`);

    // Validate and process standards
    const validatedStandards = standards.map((standard: BaseStandard) => {
      try {
        return validateStandard(standard);
      } catch (error) {
        console.error(`Validation error for standard ${standard.id}:`, error);
        return null;
      }
    }).filter((standard: BaseStandard | null): standard is BaseStandard => standard !== null);

    // Adjust depths (subtract 1 from each depth)
    const adjustedStandards: BaseStandard[] = validatedStandards.map((standard: BaseStandard) => ({
      ...standard,
      metadata: {
        ...standard.metadata,
        depth: standard.metadata.depth - 1
      }
    }));

    // Convert to Firebase format
    const firebaseData = convertToFirebaseFormat(adjustedStandards);

    // Create output directory if it doesn't exist
    const outputDir = path.resolve(__dirname, 'processed_JSON');
    await fs.mkdir(outputDir, { recursive: true });

    // Create a directory for each graph
    const graphsDir = path.join(outputDir, 'graphs');
    await fs.mkdir(graphsDir, { recursive: true });

    // Write graphs to individual directories
    for (let i = 0; i < firebaseData.graphs.length; i++) {
      const graph = firebaseData.graphs[i];
      const graphDir = path.join(graphsDir, `graph_${graph.graphId}`);
      await fs.mkdir(graphDir, { recursive: true });

      // Get nodes and edges for this graph
      const graphNodes = firebaseData.nodes.filter(node => {
        return node.nodeId === graph.rootNodeId || 
               firebaseData.edges.some(edge => 
                 edge.toNodeId === node.nodeId && 
                 isNodeInGraph(edge.fromNodeId, graph.rootNodeId, firebaseData.edges)
               );
      });

      const graphEdges = firebaseData.edges.filter(edge =>
        graphNodes.some(node => node.nodeId === edge.toNodeId)
      );

      // Calculate positions for this graph
      const nodesWithLevels = graphNodes.map(node => ({
        nodeId: node.nodeId,
        parentId: graphEdges.find(e => e.toNodeId === node.nodeId)?.fromNodeId || null,
        level: calculateNodeLevel(node.nodeId, graphEdges),
        nodePosition: { x: 0, y: 0 }
      }));

      const nodesWithPositions = calculateNodePositions(nodesWithLevels);
      const graphPosition = calculateGraphPosition();

      // Update graph and nodes with position information
      const graphWithPosition = {
        ...graph,
        graphPosition
      };

      // Create a map of node positions for easy lookup
      const nodePositions = new Map(
        nodesWithPositions.map(node => [node.nodeId, node.nodePosition])
      );

      // Update each node with its calculated position
      const nodesWithUpdatedPositions = graphNodes.map(node => {
        const position = nodePositions.get(node.nodeId);
        if (!position) {
          throw new Error(`Position not calculated for node ${node.nodeId}`);
        }
        return {
          ...node,
          nodePosition: position
        };
      });

      // Write files for this graph
      await fs.writeFile(
        path.join(graphDir, 'graph.json'),
        JSON.stringify(graphWithPosition, null, 2),
        'utf-8'
      );

      await fs.writeFile(
        path.join(graphDir, 'nodes.json'),
        JSON.stringify(nodesWithUpdatedPositions, null, 2),
        'utf-8'
      );

      await fs.writeFile(
        path.join(graphDir, 'edges.json'),
        JSON.stringify(graphEdges, null, 2),
        'utf-8'
      );

      console.log(`Written graph ${i + 1}/${firebaseData.graphs.length}: ${graph.graphName}`);
    }

    console.log('\nImport Summary:');
    console.log(`Successfully processed: ${adjustedStandards.length} standards`);
    console.log(`Failed to process: ${standards.length - adjustedStandards.length} standards`);
    console.log(`Generated:`);
    console.log(` - ${firebaseData.graphs.length} graphs`);
    console.log(` - ${firebaseData.nodes.length} total nodes`);
    console.log(` - ${firebaseData.edges.length} total edges`);
    console.log(`Output written to: ${graphsDir}`);

  } catch (error) {
    console.error('Error in import process:', error);
    throw error;
  }
}

// Helper function to check if a node belongs to a graph by traversing edges up to the root
function isNodeInGraph(nodeId: string, rootId: string, edges: Array<{ fromNodeId: string; toNodeId: string }>): boolean {
  if (nodeId === rootId) return true;
  
  const parentEdges = edges.filter(edge => edge.toNodeId === nodeId);
  return parentEdges.some(edge => isNodeInGraph(edge.fromNodeId, rootId, edges));
}

// Helper function to calculate node level
function calculateNodeLevel(nodeId: string, edges: Array<{ fromNodeId: string; toNodeId: string }>): number {
  let level = 0;
  let currentNodeId = nodeId;

  while (true) {
    const parentEdge = edges.find(e => e.toNodeId === currentNodeId);
    if (!parentEdge) break;
    level++;
    currentNodeId = parentEdge.fromNodeId;
  }

  return level;
}

// Add command line argument support
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('Running in dry-run mode - no files will be written');
}

// Run the import
importTexasStandards().catch(console.error); 