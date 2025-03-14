import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage } from "@langchain/core/messages";
import { AIRoadmapInput, AIRoadmapResponse, RoadmapContent } from "../types/ai-roadmap-types.js";
import { roadmapPromptTemplate } from "../utils/prompt-templates.js";

/**
 * Validates the structure of the roadmap content returned by the AI
 */
function validateRoadmapContent(content: RoadmapContent, expectedTopics: number): boolean {
  if (!content.mainTopics || !Array.isArray(content.mainTopics)) {
    return false;
  }

  if (content.mainTopics.length !== expectedTopics) {
    return false;
  }

  return content.mainTopics.every((topic) => {
    if (!topic.title || !topic.description || !Array.isArray(topic.subtopics)) {
      return false;
    }

    if (topic.subtopics.length !== 6) {
      return false;
    }

    return topic.subtopics.every((subtopic) => {
      return subtopic.title && subtopic.description;
    });
  });
}

/**
 * Generates a roadmap using the OpenAI API
 */
export async function generateRoadmap(
  input: AIRoadmapInput,
  apiKey: string,
): Promise<AIRoadmapResponse> {
  try {
    // Initialize the OpenAI model with the secure API key
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2500,
      openAIApiKey: apiKey,
    });

    // Initialize the JSON parser
    const parser = new JsonOutputParser<RoadmapContent>();

    // Format the prompt using the template
    const prompt = await roadmapPromptTemplate.format({
      subject: input.subject,
      basicInformation: input.basicInformation,
      content: input.content,
      numberOfTopics: input.numberOfTopics,
    });

    // Add format instructions to the prompt
    const formatInstructions = parser.getFormatInstructions();
    const promptWithFormat = `${prompt}\n\n${formatInstructions}`;

    // Create a message for the chat model
    const message = new HumanMessage(promptWithFormat);

    // Get response from OpenAI
    const response = await model.invoke([message]);

    try {
      // Use the parser to parse the response
      const responseContent = response.content.toString();
      const roadmapContent = await parser.parse(responseContent);

      // Validate the response structure
      if (!validateRoadmapContent(roadmapContent, input.numberOfTopics)) {
        throw new Error("Invalid response structure from AI");
      }

      return {
        success: true,
        data: roadmapContent,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return {
        success: false,
        error: "Failed to parse AI response",
      };
    }
  } catch (error) {
    console.error("Failed to generate roadmap:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate roadmap",
    };
  }
}
