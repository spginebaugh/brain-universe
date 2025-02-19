import { Timestamp } from 'firebase/firestore';

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