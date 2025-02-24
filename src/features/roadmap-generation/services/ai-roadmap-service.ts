import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { AIRoadmapInput, AIRoadmapResponse, RoadmapContent } from "../types/ai-roadmap-types";
import { roadmapPromptTemplate } from "../utils/prompt-templates";
import { HumanMessage } from "@langchain/core/messages";

export class AIRoadmapService {
  private model: ChatOpenAI;
  private parser: JsonOutputParser<RoadmapContent>;

  constructor() {
    this.model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2500,
      openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });
    
    // Initialize the JSON parser
    this.parser = new JsonOutputParser<RoadmapContent>();
  }

  public async generateRoadmap(input: AIRoadmapInput): Promise<AIRoadmapResponse> {
    try {
      // Format the prompt using the template
      const prompt = await roadmapPromptTemplate.format({
        subject: input.subject,
        basicInformation: input.basicInformation,
        content: input.content,
        numberOfTopics: input.numberOfTopics,
      });

      // Add format instructions to the prompt
      const formatInstructions = this.parser.getFormatInstructions();
      const promptWithFormat = `${prompt}\n\n${formatInstructions}`;

      // Create a message for the chat model
      const message = new HumanMessage(promptWithFormat);

      // Get response from OpenAI
      const response = await this.model.invoke([message]);

      try {
        // Use the parser to parse the response
        const responseContent = response.content.toString();
        const roadmapContent = await this.parser.parse(responseContent);

        // Validate the response structure
        if (!this.validateRoadmapContent(roadmapContent, input.numberOfTopics)) {
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
        error: "Failed to generate roadmap",
      };
    }
  }

  private validateRoadmapContent(content: RoadmapContent, expectedTopics: number): boolean {
    if (!content.mainTopics || !Array.isArray(content.mainTopics)) {
      return false;
    }

    if (content.mainTopics.length !== expectedTopics) {
      return false;
    }

    return content.mainTopics.every(topic => {
      if (!topic.title || !topic.description || !Array.isArray(topic.subtopics)) {
        return false;
      }

      if (topic.subtopics.length !== 6) {
        return false;
      }

      return topic.subtopics.every(subtopic => {
        return subtopic.title && subtopic.description;
      });
    });
  }
} 