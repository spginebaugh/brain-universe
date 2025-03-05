import { PromptTemplate } from "@langchain/core/prompts";

export const roadmapPromptTemplate = new PromptTemplate({
  template: `You are an expert educational content creator. Create a learning roadmap for {subject}.

Context Information:
Basic Information: {basicInformation}
Additional Content: {content}

Create a structured learning roadmap with {numberOfTopics} main topics. Each main topic should have exactly 6 subtopics.
Think of this like chapters and sections in a textbook.

Format the response as a JSON object with the following structure:
{{
  "mainTopics": [
    {{
      "title": "Main Topic Title",
      "description": "Brief description of the main topic",
      "subtopics": [
        {{
          "title": "Subtopic Title",
          "description": "Brief description of the subtopic"
        }}
      ]
    }}
  ]
}}

Requirements:
1. Generate exactly {numberOfTopics} main topics
2. Each main topic must have exactly 6 subtopics
3. Topics should follow a logical learning progression
4. Keep descriptions concise but informative
5. Ensure content is academically rigorous
6. Use proper terminology for the subject
7. Make titles clear and specific
8. Ensure subtopics directly support their main topic

The response must be valid JSON.`,
  inputVariables: ["subject", "basicInformation", "content", "numberOfTopics"],
});
