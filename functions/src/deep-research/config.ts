// Config for deep research that will use Firebase secrets
import { defineSecret } from "firebase-functions/params";

// Define secrets using firebase-functions/params
export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const TAVILY_API_KEY = defineSecret("TAVILY_API_KEY");
export const LANGSMITH_API_KEY = defineSecret("LANGSMITH_API_KEY");

export interface DeepResearchConfig {
  openai: {
    apiKey: string;
  };
  tavily: {
    apiKey: string;
  };
  langsmith: {
    apiKey: string;
    apiUrl: string;
    project: string;
    tracing: boolean;
  };
  models: {
    plannerModel: string;
    writerModel: string;
  };
  search: {
    maxDepth: number;
    numberOfQueries: number;
  };
}

/**
 * Creates a deep research configuration object using the provided secrets
 */
export function createDeepResearchConfig(): DeepResearchConfig {
  return {
    openai: {
      apiKey: OPENAI_API_KEY.value(),
    },
    tavily: {
      apiKey: TAVILY_API_KEY.value(),
    },
    langsmith: {
      apiKey: LANGSMITH_API_KEY.value(),
      apiUrl: "https://api.smith.langchain.com",
      project: "deep-research",
      tracing: true,
    },
    models: {
      plannerModel: "gpt-4o",
      writerModel: "gpt-4o",
    },
    search: {
      maxDepth: 3,
      numberOfQueries: 3,
    },
  };
}
