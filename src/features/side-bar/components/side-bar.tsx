'use client';

import { Network, ShoppingCart } from 'lucide-react';
import { useGraphStore } from '@/shared/stores/graph-store';
import { useTemplateGraphs } from '@/shared/hooks/use-template-graphs';
import { useShopStore } from '@/shared/stores/shop-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { auth } from '@/shared/services/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/config';
import { Node } from '@/shared/types/node';
import { Edge } from '@/shared/types/edge';
import { Graph, GraphType, GraphStatus } from '@/shared/types/graph';

interface SideBarProps {
  className?: string;
}

export const SideBar = ({ className = '' }: SideBarProps) => {
  const { enterPlacementMode } = useGraphStore();
  const { data: templates, isLoading } = useTemplateGraphs();
  const { toggleShop } = useShopStore();

  const handleTemplateSelect = async (templateId: string) => {
    if (!auth?.currentUser) {
      throw new Error('User must be authenticated to copy template');
    }

    // Get the template nodes and edges
    const nodesRef = collection(db, `templates/texas_TEKS/Math/${templateId}/nodes`);
    const edgesRef = collection(db, `templates/texas_TEKS/Math/${templateId}/edges`);
    
    const [nodesSnapshot, edgesSnapshot] = await Promise.all([
      getDocs(nodesRef),
      getDocs(edgesRef)
    ]);

    // Create a new graph service instance
    const graphService = new GraphService(auth.currentUser.uid);

    // Create a new graph from the template
    const newGraph: Graph = {
      graphId: crypto.randomUUID(),
      rootNodeId: '',  // Will be set to the first node
      subjectName: 'Math',
      graphName: templates?.find(t => t.graphId === templateId)?.graphName || 'Untitled Graph',
      properties: {
        description: '',
        type: 'curriculum' as GraphType,
        status: 'active' as GraphStatus
      },
      metadata: {
        fromTemplate: true,
        templateId,
        tags: []
      },
      progress: {
        completedNodes: 0,
        milestones: {}
      },
      settings: {
        progressTracking: true,
        displayOptions: {
          layout: 'user_defined',
          showProgress: true
        }
      }
    };

    // Set the root node ID to the first node
    if (nodesSnapshot.docs.length > 0) {
      newGraph.rootNodeId = nodesSnapshot.docs[0].id;
    }

    // Create the graph
    await graphService.createGraph(newGraph);

    // Copy all nodes
    const nodePromises = nodesSnapshot.docs.map(doc => {
      const nodeData = doc.data() as Node;
      return graphService.createNode(newGraph.graphId, nodeData);
    });

    // Copy all edges
    const edgePromises = edgesSnapshot.docs.map(doc => {
      const edgeData = doc.data() as Edge;
      return graphService.createEdge(newGraph.graphId, edgeData);
    });

    // Wait for all nodes and edges to be copied
    await Promise.all([...nodePromises, ...edgePromises]);

    // Enter placement mode with the root node
    enterPlacementMode(newGraph.rootNodeId);
  };

  return (
    <div 
      className={`w-16 h-screen bg-gray-900 fixed left-0 top-0 flex flex-col items-center gap-4 py-4 ${className}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Add Graph Node"
          >
            <Network className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <DropdownMenuItem disabled>
              Loading templates...
            </DropdownMenuItem>
          ) : templates?.map((template) => (
            <DropdownMenuItem
              key={template.graphId}
              onClick={() => handleTemplateSelect(template.graphId)}
              className="flex flex-col items-start gap-1"
            >
              <span className="font-medium">{template.graphName}</span>
              <span className="text-sm text-gray-500">{template.properties.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={toggleShop}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Shop"
      >
        <ShoppingCart className="w-6 h-6" />
      </button>
    </div>
  );
};

export default SideBar; 