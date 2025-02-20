import { Timestamp } from 'firebase/firestore';

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

export interface NodePosition {
  x: number;
  y: number;
}

export interface Node {
  nodeId: string;
  properties: NodeProperties;
  metadata: NodeMetadata;
  progress?: NodeProgress;
  content: NodeContent;
  extensions?: NodeExtensions;
  nodePosition: NodePosition;
} 