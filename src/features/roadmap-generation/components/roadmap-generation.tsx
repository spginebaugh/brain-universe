import { Node, useReactFlow, Position } from '@xyflow/react';
import { FlowNodeData } from '../../graph-workspace/types/workspace-types';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useState, useEffect } from 'react';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { DbNode, DbEdge } from '@/shared/types/db-types';
import { toast } from 'sonner';
import { auth } from '@/shared/services/firebase/config';
import { createNewNode, createNewEdge } from '../../graph-workspace/utils/entity-templates';
import { calculateRelativePosition } from '../../graph-workspace/utils/position-utils';
import { useGraphWorkspace } from '../../graph-workspace/hooks/use-graph-workspace';
import { useAIRoadmap } from '../hooks/use-ai-roadmap';
import { RoadmapContent } from '../types/ai-roadmap-types';
import { useDeepResearchRoadmap } from '../../deep-research/hooks/use-deep-research-roadmap';
import { DeepResearchRoadmapService } from '../../deep-research/services/deep-research-roadmap-service';
import { DeepResearchRoadmapDialog } from '../../deep-research/components/deep-research-roadmap-dialog';
import { RoadmapGenerationInput } from '../../deep-research/services/deep-research-roadmap-service';
import { useDeepResearchRoadmapStore } from '../../deep-research/stores/deep-research-roadmap-store';

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
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isDeepResearchDialogOpen, setIsDeepResearchDialogOpen] = useState(false);
  const { graphs } = useGraphWorkspace(auth?.currentUser?.uid || '');
  const { generateRoadmap, error: aiError } = useAIRoadmap();
  
  // Deep research states and hooks
  const { 
    isLoading: isDeepResearchLoading,
    error: deepResearchError,
    startDeepResearch,
    reset: resetDeepResearch
  } = useDeepResearchRoadmap({
    onPhaseChange: (phase, progress) => {
      console.log(`Deep research phase change: ${phase} - Progress: ${progress}%`);
    }
  });
  
  // Deep research roadmap service
  const [deepResearchService, setDeepResearchService] = useState<DeepResearchRoadmapService | null>(null);
  
  // Get the deep research store to monitor progress
  const deepResearchStore = useDeepResearchRoadmapStore();

  const generateNodeStructure = async (
    isAIGenerated: boolean,
    parentGraph: { graphId: string; graphPosition: { x: number; y: number } },
    graphService: GraphService,
    aiContent?: RoadmapContent
  ) => {
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
      
      const absolutePosition = {
        x: node.position.x + xPos,
        y: node.position.y + yPos
      };

      const relativePosition = calculateRelativePosition(absolutePosition, parentGraph.graphPosition);
      
      const sourcePosition = (i % 3) === 1 ? Position.Bottom : Position.Right;
      const targetPosition = (i % 3) === 1 ? Position.Top : Position.Left;
      const sourcePositionDb = (i % 3) === 1 ? 'bottom' : 'right';
      const targetPositionDb = (i % 3) === 1 ? 'top' : 'left';

      // Get the appropriate content for the node
      const mainTopic = aiContent?.mainTopics[i - 1];
      const nodeLabel = isAIGenerated 
        ? (mainTopic?.title || `AI Placeholder ${i}`)
        : `Node ${i}`;
      
      const newNode = {
        id: nodeId,
        type: 'default',
        position: absolutePosition,
        data: {
          ...node.data,
          label: nodeLabel,
          description: mainTopic?.description || '',
          status: 'active',
          graphId: node.data.graphId,
          graphName: node.data.graphName,
          properties: {
            title: nodeLabel,
            description: mainTopic?.description || '',
            type: 'concept',
            sourcePosition: sourcePositionDb,
            targetPosition: targetPositionDb,
          },
          metadata: {
            status: 'active',
            tags: [],
          },
          content: {
            mainText: mainTopic?.description || '',
            resources: [],
          },
        },
        sourcePosition,
        targetPosition,
      };
      newNodes.push(newNode);

      const dbNode = createNewNode(
        nodeId,
        relativePosition,
        nodeLabel,
        mainTopic?.description || ''
      );
      dbNode.properties.sourcePosition = sourcePositionDb;
      dbNode.properties.targetPosition = targetPositionDb;
      if (mainTopic?.description) {
        dbNode.content = {
          mainText: mainTopic.description,
          resources: []
        };
      }
      dbNodes.push(dbNode);

      if (i === 1) {
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
        const prevNodeId = newNodes.find(n => 
          isAIGenerated 
            ? n.data.label === (aiContent?.mainTopics[i-2]?.title || `AI Placeholder ${i-1}`)
            : n.data.label === `Node ${i-1}`
        )?.id;
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
        } else {
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

        // Get the appropriate content for the child node
        const subtopic = mainTopic?.subtopics[j];
        const childLabel = isAIGenerated 
          ? (subtopic?.title || `AI Placeholder ${i}${String.fromCharCode(65 + j)}`)
          : `Node ${i}${String.fromCharCode(65 + j)}`;

        const childNode = {
          id: childId,
          type: 'default',
          position: childAbsolutePosition,
          data: {
            ...node.data,
            label: childLabel,
            description: subtopic?.description || '',
            status: 'active',
            graphId: node.data.graphId,
            graphName: node.data.graphName,
            properties: {
              title: childLabel,
              description: subtopic?.description || '',
              type: 'concept',
              sourcePosition: 'right',
              targetPosition: 'left',
            },
            metadata: {
              status: 'active',
              tags: [],
            },
            content: {
              mainText: subtopic?.description || '',
              resources: [],
            },
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
        newNodes.push(childNode);

        const childDbNode = createNewNode(
          childId,
          childRelativePosition,
          childLabel,
          subtopic?.description || ''
        );
        childDbNode.properties.sourcePosition = 'right';
        childDbNode.properties.targetPosition = 'left';
        if (subtopic?.description) {
          childDbNode.content = {
            mainText: subtopic.description,
            resources: []
          };
        }
        dbNodes.push(childDbNode);

        const childEdgeId = crypto.randomUUID();
        const childEdge = {
          id: childEdgeId,
          source: nodeId,
          target: childId,
          type: 'step',
        };
        newEdges.push(childEdge);

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
  };

  const handleGenerateTemplate = async () => {
    if (!isRootNode || numNodes < 1 || numNodes > 20) return;
    
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      toast.error('You must be logged in to generate a roadmap');
      return;
    }

    const parentGraph = graphs.find(g => g.graphId === node.data.graphId);
    if (!parentGraph) {
      toast.error('Parent graph not found');
      return;
    }

    setIsGenerating(true);
    const graphService = new GraphService(currentUser.uid);

    try {
      await generateNodeStructure(false, parentGraph, graphService);
      toast.success('Template roadmap generated successfully');
      onOpenChange(false);
      onClose();
    } catch (error) {
      console.error('Failed to generate template roadmap:', error);
      toast.error('Failed to generate template roadmap');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAIRoadmap = async () => {
    if (!isRootNode || numNodes < 1 || numNodes > 20) return;
    
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      toast.error('You must be logged in to generate a roadmap');
      return;
    }

    const parentGraph = graphs.find(g => g.graphId === node.data.graphId);
    if (!parentGraph) {
      toast.error('Parent graph not found');
      return;
    }

    setIsAIGenerating(true);
    const graphService = new GraphService(currentUser.uid);

    try {
      // Generate AI content
      const aiResponse = await generateRoadmap({
        subject: node.data.properties.title || '',
        basicInformation: node.data.properties.description || '',
        content: node.data.content.mainText || '',
        numberOfTopics: numNodes,
      });

      if (!aiResponse.success || !aiResponse.data) {
        throw new Error(aiResponse.error || 'Failed to generate AI content');
      }

      // Generate nodes with AI content
      await generateNodeStructure(true, parentGraph, graphService, aiResponse.data);
      toast.success('AI roadmap generated successfully');
      onOpenChange(false);
      onClose();
    } catch (error) {
      console.error('Failed to generate AI roadmap:', error);
      toast.error(aiError || 'Failed to generate AI roadmap');
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleGenerateDeepResearchRoadmap = async () => {
    if (!isRootNode || numNodes < 1 || numNodes > 20) return;
    
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      toast.error('You must be logged in to generate a roadmap');
      return;
    }

    const parentGraph = graphs.find(g => g.graphId === node.data.graphId);
    if (!parentGraph) {
      toast.error('Parent graph not found');
      return;
    }

    // Create deep research service
    const service = new DeepResearchRoadmapService(currentUser.uid);
    setDeepResearchService(service);
    
    // Reset the deep research store state
    resetDeepResearch();
    
    // Show dialog immediately
    setIsDeepResearchDialogOpen(true);
    
    // Start deep research in parallel with hook
    try {
      // Start the hook for tracking state
      await startDeepResearch({
        query: node.data.properties.title || '',
        numberOfChapters: numNodes
      });
      
      // Generate the roadmap using the service
      const roadmapInput: RoadmapGenerationInput = {
        rootNodeId: node.id,
        rootNodePosition: node.position,
        rootNodeTitle: node.data.properties.title || '',
        graphId: node.data.graphId,
        graphName: node.data.graphName || '',
        graphPosition: parentGraph.graphPosition,
        numberOfChapters: numNodes,
        userId: currentUser.uid
      };
      
      // Run the roadmap generation
      await service.generateRoadmap(roadmapInput);
      
    } catch (error) {
      console.error('Failed to generate deep research roadmap:', error);
      toast.error(deepResearchError || 'Failed to generate deep research roadmap');
    }
  };

  const handleDeepResearchCancel = () => {
    if (deepResearchService) {
      deepResearchService.cancel();
    }
    resetDeepResearch();
    setIsDeepResearchDialogOpen(false);
  };

  const handleDeepResearchComplete = () => {
    toast.success('Deep research roadmap generated successfully');
    setIsDeepResearchDialogOpen(false);
    onOpenChange(false);
    onClose();
  };

  // Monitor the deep research store to automatically close the dialog when finished
  useEffect(() => {
    if (!isDeepResearchDialogOpen) return;
    
    const isComplete = !deepResearchStore.isLoading && deepResearchStore.progress === 100;
    const hasError = !!deepResearchStore.error;
    
    if (isComplete || hasError) {
      // Auto-close after a short delay
      const timer = setTimeout(() => {
        if (isComplete) {
          handleDeepResearchComplete();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [
    isDeepResearchDialogOpen,
    deepResearchStore.isLoading,
    deepResearchStore.progress,
    deepResearchStore.error
  ]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Generate Roadmap</DialogTitle>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="numNodes" className="col-span-2">
                Number of Main Topics (1-20)
              </Label>
              <Input
                id="numNodes"
                type="number"
                min={1}
                max={20}
                value={numNodes}
                onChange={(e) => setNumNodes(Number(e.target.value))}
                className="col-span-2"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleGenerateTemplate}
              disabled={isGenerating || isAIGenerating || isDeepResearchLoading}
            >
              {isGenerating ? 'Generating Template...' : 'Generate Roadmap Template'}
            </Button>
            <Button
              onClick={handleGenerateAIRoadmap}
              disabled={isGenerating || isAIGenerating || isDeepResearchLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAIGenerating ? 'Generating AI Roadmap...' : 'Generate AI Roadmap'}
            </Button>
            <Button
              onClick={handleGenerateDeepResearchRoadmap}
              disabled={isGenerating || isAIGenerating || isDeepResearchLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDeepResearchLoading ? 'Researching...' : 'Generate Deep Research Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeepResearchRoadmapDialog
        isOpen={isDeepResearchDialogOpen}
        onOpenChange={setIsDeepResearchDialogOpen}
        onCancel={handleDeepResearchCancel}
        onComplete={handleDeepResearchComplete}
      />
    </>
  );
}; 