```
{
  // Core Properties
  graphId: string,
  rootNodeId: string,
  subjectName: string,
  graphName: string,
  graphPosition: {
    x: number,
    y: number
  },
  properties: {
    description: string,
    type: "curriculum" | "quiz_set" | "learning_exploration" | "idea_map" | string,
    status: "active" | "archived" | "completed"
  },

  // Metadata
  metadata: {
    fromTemplate: boolean,
    templateId?: string,  // if created from template
    tags: string[]
  },

  // Progress Tracking
  progress: {
    completedNodes: number,
    averageScore?: number,
    lastActivity: timestamp,
    milestones: {
      [milestone: string]: {
        achieved: boolean,
        achievedAt?: timestamp
      }
    }
  },

  // Settings
  settings: {
    progressTracking: boolean,
    displayOptions: {
      layout: "tree" | "force" | "hierarchical" | "user_defined",
      showProgress: boolean
    }
  },

  // Extension Point for Future Features
  extensions: {
    [key: string]: any  // Flexible extension point
  }
}
```