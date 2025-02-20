import { DbNode, DbEdge, DbGraph } from '@/shared/types/db-types';
import { Position } from './position-utils';

export const createNewNode = (
  nodeId: string,
  position: Position,
  title = '',
  description = ''
): DbNode => ({
  nodeId,
  properties: {
    title,
    description,
    type: 'concept'
  },
  metadata: {
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: []
  },
  content: {
    text: '',
    resources: []
  },
  nodePosition: position
}) as unknown as DbNode;

export const createNewEdge = (
  edgeId: string,
  fromNodeId: string,
  toNodeId: string
): DbEdge => ({
  edgeId,
  fromNodeId,
  toNodeId,
  isDirected: true,
  relationshipType: 'tree_edge',
}) as unknown as DbEdge;

export const createNewGraph = (
  graphId: string,
  rootNodeId: string,
  position: Position
): DbGraph => ({
  graphId,
  rootNodeId,
  subjectName: '',
  graphName: '',
  properties: {
    description: '',
    type: 'idea_map',
    status: 'active'
  },
  metadata: {
    fromTemplate: false,
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
  },
  graphPosition: position
}) as unknown as DbGraph; 