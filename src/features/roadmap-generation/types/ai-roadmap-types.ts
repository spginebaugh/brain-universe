interface SubTopic {
  title: string;
  description: string;
}

interface MainTopic {
  title: string;
  description: string;
  subtopics: SubTopic[];
}

export interface RoadmapContent {
  mainTopics: MainTopic[];
}

export interface AIRoadmapInput {
  subject: string;
  basicInformation: string;
  content: string;
  numberOfTopics: number;
}

export interface AIRoadmapResponse {
  success: boolean;
  data?: RoadmapContent;
  error?: string;
} 