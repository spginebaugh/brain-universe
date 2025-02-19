import { Timestamp } from 'firebase/firestore';

// Graph types
export type GraphType = 'curriculum' | 'quiz_set' | 'learning_exploration' | 'idea_map' | string;
export type GraphStatus = 'active' | 'archived' | 'completed';
export type GraphLayout = 'tree' | 'force' | 'hierarchical' | 'user_defined';

export interface GraphProperties {
  name: string;
  description: string;
  type: GraphType;
  status: GraphStatus;
}

export interface GraphMetadata {
  fromTemplate: boolean;
  templateId?: string;
  tags: string[];
}

export interface GraphMilestone {
  achieved: boolean;
  achievedAt?: Timestamp;
}

export interface GraphProgress {
  completedNodes: number;
  averageScore?: number;
  lastActivity?: Timestamp;
  milestones: {
    [milestone: string]: GraphMilestone;
  };
}

export interface GraphDisplayOptions {
  layout: GraphLayout;
  showProgress: boolean;
}

export interface GraphSettings {
  progressTracking: boolean;
  displayOptions: GraphDisplayOptions;
}

export interface GraphExtensions {
  [key: string]: unknown;
}

export interface Graph {
  graphId: string;
  rootNodeId: string;
  subjectName: string;
  properties: GraphProperties;
  metadata: GraphMetadata;
  progress: GraphProgress;
  settings: GraphSettings;
  extensions?: GraphExtensions;
}

// Node types
export type NodeType = 'standard' | 'quiz' | 'text' | 'video' | string;
export type NodeStatus = 'active' | 'archived' | 'completed' | 'in_progress';

export interface NodeProperties {
  title: string;
  description: string;
  type: NodeType;
}

export interface NodeMetadata {
  status: NodeStatus;
  tags: string[];
  prerequisites?: string[];
}

export interface NodeProgress {
  score?: number;
  lastAttempt?: Timestamp;
  attempts?: number;
}

export interface QuizQuestion {
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface TextSection {
  title: string;
  content: string;
}

export interface NodeContent {
  questions?: QuizQuestion[];
  mainText?: string;
  sections?: {
    [sectionId: string]: TextSection;
  };
  videoUrl?: string;
  transcript?: string;
  [key: string]: unknown;
}

export interface NodeExtensions {
  [key: string]: unknown;
}

export interface Node {
  nodeId: string;
  properties: NodeProperties;
  metadata: NodeMetadata;
  progress?: NodeProgress;
  content: NodeContent;
  extensions?: NodeExtensions;
}

// Edge types
export interface EdgeExtensions {
  [key: string]: unknown;
}

export interface Edge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  isDirected: boolean;
  relationshipType: string;
  extensions?: EdgeExtensions;
} 