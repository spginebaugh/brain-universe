import { Node, useReactFlow, Position } from '@xyflow/react';
import { FlowNodeData } from '../types/workspace-types';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useState } from 'react';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { DbNode, DbEdge } from '@/shared/types/db-types';
import { toast } from 'sonner';
import { auth } from '@/shared/services/firebase/config';
import { createNewNode, createNewEdge } from '../utils/entity-templates';
import { calculateRelativePosition } from '../utils/position-utils';
import { useGraphWorkspace } from '../hooks/use-graph-workspace';

interface RoadmapGenerationProps {
  node: Node<FlowNodeData>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  isRootNode: boolean;
}

export const RoadmapGeneration = ({ 
  node, 
  isOpen, 
  onOpenChange, 
  onClose,
  isRootNode 
}: RoadmapGenerationProps) => {
  const { addNodes, addEdges } = useReactFlow();
  const [numNodes, setNumNodes] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const { graphs } = useGraphWorkspace(auth?.currentUser?.uid || '');

  const handleGenerateRoadmap = async () => {
    if (!isRootNode || numNodes < 1 || numNodes > 20) return;
    
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      toast.error('You must be logged in to generate a roadmap');
      return;
    }

    // Get the parent graph
    const parentGraph = graphs.find(g => g.graphId === node.data.graphId);
    if (!parentGraph) {
      toast.error('Parent graph not found');
      return;
    }

    setIsGenerating(true);
    const graphService = new GraphService(currentUser.uid);

    try {
      const xDistance = 300;
      const yDistance = 400;
      const newNodes = [];
      const newEdges = [];
      const dbNodes: DbNode[] = [];
      const dbEdges: DbEdge[] = [];

      // Create nodes
      for (let i = 1; i <= numNodes; i++) {
        const nodeId = crypto.randomUUID();
        const xPos = (i - 1) * xDistance;
        const yPos = (i % 3) * yDistance;
        
        // Calculate absolute position for ReactFlow
        const absolutePosition = {
          x: node.position.x + xPos,
          y: node.position.y + yPos
        };

        // Calculate relative position for Firestore
        const relativePosition = calculateRelativePosition(absolutePosition, parentGraph.graphPosition);
        
        // Determine source and target positions
        const sourcePosition = (i % 3) === 1 ? Position.Bottom : Position.Right;
        const targetPosition = (i % 3) === 1 ? Position.Top : Position.Left;
        const sourcePositionDb = (i % 3) === 1 ? 'bottom' : 'right';
        const targetPositionDb = (i % 3) === 1 ? 'top' : 'left';

        // Create ReactFlow node for immediate display
        const newNode = {
          id: nodeId,
          type: 'default',
          position: absolutePosition,
          data: {
            ...node.data,
            label: `Node ${i}`,
          },
          sourcePosition,
          targetPosition,
        };
        newNodes.push(newNode);

        // Create Firestore node
        const dbNode = createNewNode(
          nodeId,
          relativePosition,
          `Node ${i}`
        );
        // Add source and target positions
        dbNode.properties.sourcePosition = sourcePositionDb;
        dbNode.properties.targetPosition = targetPositionDb;
        dbNodes.push(dbNode);

        // Create edge from root to first node, or from previous node to current node
        if (i === 1) {
          // First node connects to root node
          const rootEdgeId = crypto.randomUUID();
          const rootEdge = {
            id: rootEdgeId,
            source: node.id,
            target: nodeId,
            type: 'step',
          };
          newEdges.push(rootEdge);
          const rootDbEdge = createNewEdge(rootEdgeId, node.id, nodeId);
          dbEdges.push(rootDbEdge);
        } else {
          // Connect to previous parent node
          const prevNodeId = newNodes.find(n => n.data.label === `Node ${i-1}`)?.id;
          if (prevNodeId) {
            const edgeId = crypto.randomUUID();
            const newEdge = {
              id: edgeId,
              source: prevNodeId,
              target: nodeId,
              type: 'step',
            };
            newEdges.push(newEdge);
            const dbEdge = createNewEdge(edgeId, prevNodeId, nodeId);
            dbEdges.push(dbEdge);
          }
        }

        // Generate 6 child nodes for this parent node
        const childYPositions = (() => {
          const mod = i % 3;
          if (mod === 1) {
            return [
              yDistance - (yDistance / 8) * 1.5,
              yDistance,
              yDistance + (yDistance / 8) * 1.5
            ];
          } else if (mod === 2) {
            return [
              yDistance * 2 + (yDistance / 8) * 1,
              yDistance * 2 + (yDistance / 8) * 2.5,
              yDistance * 2 + (yDistance / 8) * 4
            ];
          } else { // mod === 0
            return [
              -(yDistance / 8) * 4,
              -(yDistance / 8) * 2.5,
              -(yDistance / 8) * 1
            ];
          }
        })();

        const childXOffsets = (() => {
          const mod = i % 3;
          if (mod === 1) {
            return [-xDistance, xDistance];
          } else {
            return [-xDistance/2, xDistance/2];
          }
        })();

        // Create child nodes
        for (let j = 0; j < 6; j++) {
          const childId = crypto.randomUUID();
          const isLeftSide = j < 3;
          const yIndex = j % 3;
          
          const childAbsolutePosition = {
            x: node.position.x + xPos + (isLeftSide ? childXOffsets[0] : childXOffsets[1]),
            y: node.position.y + childYPositions[yIndex]
          };

          const childRelativePosition = calculateRelativePosition(childAbsolutePosition, parentGraph.graphPosition);

          // Create ReactFlow child node
          const childNode = {
            id: childId,
            type: 'default',
            position: childAbsolutePosition,
            data: {
              ...node.data,
              label: `Node ${i}${String.fromCharCode(65 + j)}`, // A, B, C, D, E, F
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          };
          newNodes.push(childNode);

          // Create Firestore child node
          const childDbNode = createNewNode(
            childId,
            childRelativePosition,
            `Node ${i}${String.fromCharCode(65 + j)}`
          );
          childDbNode.properties.sourcePosition = 'right';
          childDbNode.properties.targetPosition = 'left';
          dbNodes.push(childDbNode);

          // Create edge from parent to child
          const childEdgeId = crypto.randomUUID();
          
          // Create ReactFlow edge
          const childEdge = {
            id: childEdgeId,
            source: nodeId, // Parent node is the source
            target: childId, // Child node is the target
            type: 'step',
          };
          newEdges.push(childEdge);

          // Create Firestore edge
          const childDbEdge = createNewEdge(childEdgeId, nodeId, childId);
          dbEdges.push(childDbEdge);
        }
      }

      // Save all nodes and edges to Firestore
      const savePromises = [
        ...dbNodes.map(dbNode => graphService.createNode(node.data.graphId, dbNode)),
        ...dbEdges.map(dbEdge => graphService.createEdge(node.data.graphId, dbEdge))
      ];

      await Promise.all(savePromises);

      // Update ReactFlow state
      addNodes(newNodes);
      addEdges(newEdges);

      toast.success('Roadmap generated successfully');
      onOpenChange(false);
      onClose();
    } catch (error) {
      console.error('Failed to generate roadmap:', error);
      toast.error('Failed to generate roadmap');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle className="text-center">Roadmap Generation</DialogTitle>
        {isRootNode ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nodes" className="col-span-2">
                Number of nodes in roadmap
              </Label>
              <Input
                id="nodes"
                type="number"
                min={1}
                max={20}
                value={numNodes}
                onChange={(e) => setNumNodes(Number(e.target.value))}
                className="col-span-2"
                disabled={isGenerating}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-lg">Option Only Available for Root Nodes</p>
          </div>
        )}
        {isRootNode && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateRoadmap} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Roadmap'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}; 