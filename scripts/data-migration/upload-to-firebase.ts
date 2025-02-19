import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { Graph, Node, Edge } from './types/firebase-types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the service account path from environment variable
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
}

// Read and parse the service account key
const serviceAccount = JSON.parse(
  fsSync.readFileSync(path.resolve(__dirname, serviceAccountPath), 'utf-8')
);

// Initialize Firebase Admin with the service account
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

interface GraphData {
  graph: Graph;
  nodes: Node[];
  edges: Edge[];
}

async function uploadGraphAsTemplate(
  graphData: GraphData,
  source: string,
  subject: string
): Promise<void> {
  const { graph, nodes, edges } = graphData;
  const templatePath = `templates/${source}/${subject}`;

  // Create a batch for atomic operations
  const batch = db.batch();

  // Add graph document
  const graphRef = db.doc(`${templatePath}/${graph.graphId}`);
  batch.set(graphRef, graph);

  // Add nodes
  const nodesCollection = graphRef.collection('nodes');
  nodes.forEach(node => {
    const nodeRef = nodesCollection.doc(node.nodeId);
    batch.set(nodeRef, node);
  });

  // Add edges
  const edgesCollection = graphRef.collection('edges');
  edges.forEach(edge => {
    const edgeRef = edgesCollection.doc(edge.edgeId);
    batch.set(edgeRef, edge);
  });

  // Commit the batch
  await batch.commit();
  console.log(`Uploaded graph ${graph.graphId} to ${templatePath}`);
}

async function uploadAllTemplates(): Promise<void> {
  try {
    const graphsDir = path.resolve(__dirname, 'processed_JSON/graphs');
    const graphDirs = await fs.readdir(graphsDir);

    console.log('Starting template upload...');
    
    for (const dir of graphDirs) {
      if (!dir.startsWith('graph_')) continue;

      // Read graph data
      const graphPath = path.join(graphsDir, dir);
      const [graphData, nodesData, edgesData] = await Promise.all([
        fs.readFile(path.join(graphPath, 'graph.json'), 'utf-8'),
        fs.readFile(path.join(graphPath, 'nodes.json'), 'utf-8'),
        fs.readFile(path.join(graphPath, 'edges.json'), 'utf-8')
      ]);

      const graph: Graph = JSON.parse(graphData);
      const nodes: Node[] = JSON.parse(nodesData);
      const edges: Edge[] = JSON.parse(edgesData);

      // Extract source and subject from metadata
      const templateId = graph.metadata.templateId;
      if (!templateId) {
        console.warn(`Skipping graph ${graph.graphId}: No template ID found`);
        continue;
      }

      const [source, subject] = templateId.split('-');
      if (!source || !subject) {
        console.warn(`Skipping graph ${graph.graphId}: Invalid template ID format`);
        continue;
      }

      await uploadGraphAsTemplate(
        { graph, nodes, edges },
        source,
        subject
      );
    }

    console.log('Template upload completed successfully');
  } catch (error) {
    console.error('Error uploading templates:', error);
    throw error;
  }
}

// Add command line argument support
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('Running in dry-run mode - no data will be uploaded to Firebase');
} else {
  uploadAllTemplates().catch(console.error);
} 