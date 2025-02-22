export const config = {
  openai: {
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  },
  tavily: {
    apiKey: process.env.NEXT_PUBLIC_TAVILY_API_KEY!,
  },
  langsmith: {
    apiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY!,
    apiUrl: process.env.NEXT_PUBLIC_LANGSMITH_API_URL!,
    project: process.env.NEXT_PUBLIC_LANGSMITH_PROJECT!,
    tracing: process.env.NEXT_PUBLIC_ENABLE_LANGSMITH_TRACING === 'true',
  },
};

// Validate required environment variables
const requiredEnvVars = {
  'OpenAI API Key': config.openai.apiKey,
  'Tavily API Key': config.tavily.apiKey,
  'LangSmith API Key': config.langsmith.apiKey,
  'LangSmith API URL': config.langsmith.apiUrl,
  'LangSmith Project': config.langsmith.project,
};

Object.entries(requiredEnvVars).forEach(([name, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}); 