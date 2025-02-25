import { Position } from '@xyflow/react';
import { Chapter } from '../types/research';
import { createNewNode, createNewEdge } from '../../graph-workspace/utils/entity-templates';
import { calculateRelativePosition } from '../../graph-workspace/utils/position-utils';
import { DbNode, DbEdge } from '@/shared/types/db-types';
import { NodeMetadata, NodeProperties, NodeStatus } from '@/shared/types/node';

export interface NodeGenerationOptions {
  parentNodeId: string;
  parentNodePosition: { x: number; y: number };
  graphId: string;
  graphName: string;
  graphPosition: { x: number; y: number };
}

export interface GeneratedNodeStructure {
  reactFlowNodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
    sourcePosition?: Position;
    targetPosition?: Position;
  }>;
  reactFlowEdges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  dbNodes: DbNode[];
  dbEdges: DbEdge[];
}

// Generate placeholder nodes for planned chapters
export function generatePlaceholderNodesFromChapters(
  chapters: Chapter[],
  options: NodeGenerationOptions
): GeneratedNodeStructure {
  const { parentNodeId, parentNodePosition, graphId, graphName, graphPosition } = options;
  
  const reactFlowNodes: GeneratedNodeStructure['reactFlowNodes'] = [];
  const reactFlowEdges: GeneratedNodeStructure['reactFlowEdges'] = [];
  const dbNodes: DbNode[] = [];
  const dbEdges: DbEdge[] = [];
  
  const xDistance = 300;
  const yDistance = 400;
  
  // Create nodes for each chapter
  chapters.forEach((chapter, index) => {
    const nodeId = crypto.randomUUID();
    // Update positioning to match roadmap-generation.tsx
    // Start with an offset of 1 to avoid placing at the root node position
    const xPos = (index) * xDistance;
    const yPos = ((index + 1) % 3) * yDistance;
    
    const absolutePosition = {
      x: parentNodePosition.x + xPos,
      y: parentNodePosition.y + yPos
    };
    
    const relativePosition = calculateRelativePosition(absolutePosition, graphPosition);
    
    const sourcePosition = ((index + 1) % 3) === 1 ? Position.Bottom : Position.Right;
    const targetPosition = ((index + 1) % 3) === 1 ? Position.Top : Position.Left;
    const sourcePositionDb = ((index + 1) % 3) === 1 ? 'bottom' : 'right';
    const targetPositionDb = ((index + 1) % 3) === 1 ? 'top' : 'left';
    
    // Create placeholder node
    const newNode = {
      id: nodeId,
      type: 'default',
      position: absolutePosition,
      data: {
        label: chapter.title,
        description: chapter.description || 'Loading...',
        status: 'active',
        graphId,
        graphName,
        properties: {
          title: chapter.title,
          description: chapter.description || 'Loading...',
          type: 'concept',
          sourcePosition: sourcePositionDb,
          targetPosition: targetPositionDb,
        },
        metadata: {
          status: 'in_progress' as NodeStatus,
          tags: [],
        },
        content: {
          mainText: chapter.description || 'Loading...',
          resources: [],
        },
        sourcePosition,
        targetPosition,
      },
      sourcePosition,
      targetPosition,
    };
    
    reactFlowNodes.push(newNode);
    
    // Create DB node
    const dbNode = createNewNode(
      nodeId,
      relativePosition,
      chapter.title,
      chapter.description || 'Loading...'
    );
    dbNode.properties.sourcePosition = sourcePositionDb;
    dbNode.properties.targetPosition = targetPositionDb;
    dbNode.metadata.status = 'in_progress';
    dbNodes.push(dbNode);
    
    // Create edge from parent to this node
    if (index === 0) {
      const edgeId = crypto.randomUUID();
      const newEdge = {
        id: edgeId,
        source: parentNodeId,
        target: nodeId,
        type: 'step',
      };
      reactFlowEdges.push(newEdge);
      
      const dbEdge = createNewEdge(edgeId, parentNodeId, nodeId);
      dbEdges.push(dbEdge);
    }
    
    // Create edge from previous node if not first node
    if (index > 0) {
      const prevNodeId = reactFlowNodes[index - 1].id;
      const edgeId = crypto.randomUUID();
      const newEdge = {
        id: edgeId,
        source: prevNodeId,
        target: nodeId,
        type: 'step',
      };
      reactFlowEdges.push(newEdge);
      
      const dbEdge = createNewEdge(edgeId, prevNodeId, nodeId);
      dbEdges.push(dbEdge);
    }
  });
  
  return {
    reactFlowNodes,
    reactFlowEdges,
    dbNodes,
    dbEdges
  };
}

// Generate subtopic nodes for a chapter
export function generateSubtopicNodesForChapter(
  chapter: Chapter,
  parentNodeId: string,
  parentNodePosition: { x: number; y: number },
  graphId: string,
  graphName: string,
  graphPosition: { x: number; y: number },
  parentIndex: number = 0
): GeneratedNodeStructure {
  const reactFlowNodes: GeneratedNodeStructure['reactFlowNodes'] = [];
  const reactFlowEdges: GeneratedNodeStructure['reactFlowEdges'] = [];
  const dbNodes: DbNode[] = [];
  const dbEdges: DbEdge[] = [];
  
  // If no content or subtopics, return empty structure
  if (!chapter.content || !chapter.content.subTopics) {
    return { reactFlowNodes, reactFlowEdges, dbNodes, dbEdges };
  }
  
  const subTopics = chapter.content.subTopics;
  const subTopicNames = Object.keys(subTopics);
  
  // Constants for positioning
  const xDistance = 300;
  const yDistance = 400;
  
  // Use the provided parentIndex instead of calculating it
  // Calculate positions based on parent index using the same logic as roadmap-generation.tsx
  const childYPositions = (() => {
    const mod = (parentIndex + 1) % 3;
    if (mod === 1) {
      return [
        -(yDistance / 6) * 1.5,
        0,
        (yDistance / 6) * 1.5,
        -(yDistance / 6) * 1.5,
        0,
        (yDistance / 6) * 1.5
      ];
    } else if (mod === 2) {
      return [
        (yDistance / 6) * 1 + 50,
        (yDistance / 6) * 2.5 + 50,
        (yDistance / 6) * 4 + 50,
        (yDistance / 6) * 1 + 50,
        (yDistance / 6) * 2.5 + 50,
        (yDistance / 6) * 4 + 50
      ];
    } else {
      return [
        -(yDistance / 6) * 4 - 50,
        -(yDistance / 6) * 2.5 - 50,
        -(yDistance / 6) * 1 - 50,
        -(yDistance / 6) * 4 - 50,
        -(yDistance / 6) * 2.5 - 50,
        -(yDistance / 6) * 1 - 50
      ];
    }
  })();

  const childXOffsets = (() => {
    const mod = (parentIndex + 1) % 3;
    if (mod === 1) {
      return [
        -xDistance, -xDistance, -xDistance,  // Left side
        xDistance, xDistance, xDistance      // Right side
      ];
    } else {
      return [
        -xDistance/2, -xDistance/2, -xDistance/2,  // Left side
        xDistance/2, xDistance/2, xDistance/2      // Right side
      ];
    }
  })();
  
  // Create nodes for each subtopic
  subTopicNames.forEach((subTopicName, index) => {
    // Limit to 6 subtopics
    if (index >= 6) return;
    
    const subTopic = subTopics[subTopicName];
    const nodeId = crypto.randomUUID();
    
    // Determine if this is a left or right side node
    const isLeftSide = index < 3;
    
    const absolutePosition = {
      x: parentNodePosition.x + childXOffsets[index],
      y: parentNodePosition.y + childYPositions[index]
    };
    
    const relativePosition = calculateRelativePosition(absolutePosition, graphPosition);
    
    // Set source and target positions based on whether it's a left or right side node
    const sourcePosition = isLeftSide ? Position.Left : Position.Right;
    const targetPosition = isLeftSide ? Position.Right : Position.Left;

    
    // Create node
    const newNode = {
      id: nodeId,
      type: 'default',
      position: absolutePosition,
      data: {
        label: subTopic.title,
        description: subTopic.description || '',
        status: 'active',
        graphId,
        graphName,
        properties: {
          title: subTopic.title,
          description: subTopic.description || '',
          type: 'concept',
          sourcePosition: sourcePosition,
          targetPosition: targetPosition,
        },
        metadata: {
          status: 'active' as NodeStatus,
          tags: [],
        },
        content: {
          mainText: subTopic.content || '',
          resources: subTopic.sources?.map(src => ({
            title: src.title,
            url: src.url,
            type: 'link'
          })) || [],
        },
      },
      sourcePosition: sourcePosition,
      targetPosition: targetPosition,
    };
    
    reactFlowNodes.push(newNode);
    
    // Create DB node
    const dbNode = createNewNode(
      nodeId,
      relativePosition,
      subTopic.title,
      subTopic.description || ''
    );
    dbNode.properties.sourcePosition = sourcePosition;
    dbNode.properties.targetPosition = targetPosition;
    
    if (subTopic.content) {
      dbNode.content = {
        mainText: subTopic.content,
        resources: subTopic.sources?.map(src => ({
          title: src.title,
          url: src.url,
          type: 'link'
        })) || []
      };
    }
    
    dbNodes.push(dbNode);
    
    // Create edge from parent to this node
    const edgeId = crypto.randomUUID();
    const newEdge = {
      id: edgeId,
      source: parentNodeId,
      target: nodeId,
      type: 'step',
    };
    reactFlowEdges.push(newEdge);
    
    const dbEdge = createNewEdge(edgeId, parentNodeId, nodeId);
    dbEdges.push(dbEdge);
  });
  
  return {
    reactFlowNodes,
    reactFlowEdges,
    dbNodes,
    dbEdges
  };
}

// Update chapters with research data
export function updateCompletedChapter(
  chapter: Chapter
): Partial<DbNode> {
  // Extract content from the research data
  const chapterContent = chapter.content;
  
  if (!chapterContent) {
    return {
      metadata: { 
        status: 'active' as NodeStatus,
        tags: []
      }
    };
  }
  
  // Update the node with the content from research
  return {
    properties: {
      title: chapter.title,
      description: chapter.description || '',
      type: 'concept'
    } as NodeProperties,
    content: {
      mainText: chapterContent.overview || '',
      resources: []
    },
    metadata: {
      status: 'active' as NodeStatus,
      tags: []
    } as NodeMetadata
  };
} 