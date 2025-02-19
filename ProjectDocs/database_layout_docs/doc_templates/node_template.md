```
{
  // Core Properties
  nodeId: string,
  properties: {
    title: string,
    description: string,
    type: "standard" | "quiz" | "text" | "video" | string, // extensible for new types
  },

  // Metadata
  metadata: {
    status: "active" | "archived" | "completed" | "in_progress"
    tags: string[],
    prerequisites?: string[]
  },

  progress?: {
    score?: number,
    lastAttempt?: timestamp,
    attempts?: number
  },

  // Flexible Content Based on Type
  content: {
    
    // For quizzes
    questions?: {
      prompt: string,
      options?: string[],
      correctAnswer: string,
      explanation?: string
    }[],
    
    // For text content
    mainText?: string,
    sections?: {
      [sectionId: string]: {
        title: string,
        content: string
      }
    },
    
    // For video content
    videoUrl?: string,
    transcript?: string,
    
    // Extensible for future content types
    [key: string]: any
  },

  // Extension Point for Future Features
  extensions: {
    [key: string]: any  // Flexible extension point
  }
}
```