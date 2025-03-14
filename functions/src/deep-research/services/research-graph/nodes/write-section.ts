import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import {
  ResearchState,
  Chapter,
  ChapterContent,
  RESEARCH_PHASES,
} from "../../../types/research";

// Define the schema for structured output
const sourceSchema = z.object({
  title: z.string().describe("The title of the source"),
  url: z.string().describe("The URL of the source"),
});

const subTopicSchema = z.object({
  title: z.string().describe("The title of the sub-topic"),
  description: z.string().describe("A brief description of the sub-topic"),
  content: z.string().describe("In-depth lesson content about the sub-topic (at least 1000 words)"),
  sources: z.array(sourceSchema).describe("At least one relevant source with title and URL"),
});

const chapterContentSchema = z.object({
  overview: z.string().describe("A 100-150 word overview of the chapter"),
  subTopics: z.record(z.string(), subTopicSchema).describe("A record of sub-topics, with each key being the sub-topic name"),
});

const WRITE_CHAPTER_TEMPLATE = `You are an expert technical teacher crafting a detailed lesson for one chapter of a learning roadmap.

Chapter Information:
Title: {chapterTitle}
Description: {chapterDescription}
SubTopics: {subTopicNames}

Research Data:
{sourceData}

Write a comprehensive chapter that:
1. Starts with an overview of the main topic (100-150 words)
2. Includes detailed sub-topics as specified
3. Incorporates relevant information from the research data
4. Maintains academic tone and factual accuracy

Each sub-topic must include:
- The provided sub-topic names as keys in the subTopics object
- A brief description of the sub-topic
- Content section. This should be an in-depth lesson about the sub-topic topic (at least 1000 words).
    - Aim for factual accuracy and academic tone
    - Go into depth about the sub-topic topic
    - Write in a way that will provide readers a deep understanding of the topic
- At least one relevant source with title and URL

IMPORTANT: You MUST create a sub-topic entry for EACH of the sub-topic names provided in the list. The list of sub-topic names is: {subTopicNames}

{format_instructions}`;

// Define additional types for internal state management
interface WriteStateExtension {
  currentChapter?: Chapter;
  sourceStr?: string;
}

type ExtendedResearchState = ResearchState & WriteStateExtension;

/**
 * Write section node
 */
export function writeSectionNode(model: ChatOpenAI) {
  type PrepareOutput = {
    chapterTitle: string;
    chapterDescription: string;
    subTopicNames: string;
    sourceData: string;
    currentState: ExtendedResearchState;
  };

  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(chapterContentSchema);
  const formatInstructions = parser.getFormatInstructions();

  const prompt = PromptTemplate.fromTemplate<PrepareOutput & { format_instructions: string }>(WRITE_CHAPTER_TEMPLATE);

  const prepareData = new RunnableLambda({
    func: (state: ExtendedResearchState) => {
      if (!state.currentChapter) {
        throw new Error("Missing chapter in state");
      }

      if (!state.sourceStr) {
        throw new Error("Missing source data in state");
      }

      return {
        chapterTitle: state.currentChapter.title,
        chapterDescription: state.currentChapter.description,
        subTopicNames: state.currentChapter.subTopicNames.join(", "),
        sourceData: state.sourceStr,
        format_instructions: formatInstructions,
        currentState: state,
      };
    },
  });

  // Transform the model output to include state
  const addState = new RunnableLambda({
    func: (input: { response: PrepareOutput; generated: ChapterContent }) => ({
      response: input.generated,
      currentState: input.response.currentState,
    }),
  });

  const processResponse = new RunnableLambda({
    func: (input: { response: ChapterContent; currentState: ExtendedResearchState }) => {
      console.log("Processing chapter content response:", input.response);

      // Validate the content structure
      if (!input.response || typeof input.response !== "object") {
        console.error("Invalid chapter content response:", input.response);
        throw new Error("Invalid chapter content response: not an object");
      }

      if (!input.response.overview) {
        console.warn("Missing overview in chapter content:", input.response);
        // Set default overview if missing
        input.response.overview = `Chapter overview for ${input.currentState.currentChapter?.title}`;
      }

      if (!input.response.subTopics || typeof input.response.subTopics !== "object") {
        console.warn("Missing or invalid subTopics in chapter content:", input.response);
        // Create default subTopics structure if missing
        input.response.subTopics = {};
      }

      // Ensure all expected subTopics are present
      if (input.currentState.currentChapter?.subTopicNames) {
        const expectedSubTopics = input.currentState.currentChapter.subTopicNames;
        const actualSubTopics = Object.keys(input.response.subTopics);

        console.log("Expected subTopics:", expectedSubTopics);
        console.log("Actual subTopics:", actualSubTopics);

        // Add missing subTopics
        expectedSubTopics.forEach((name: string) => {
          if (!input.response.subTopics[name]) {
            console.warn(`Missing subTopic: ${name}, adding default content`);
            input.response.subTopics[name] = {
              title: name,
              description: `Description for ${name}`,
              content: `Default content for ${name}`,
              sources: [],
            };
          }
        });
      }

      // Ensure currentChapter exists
      if (!input.currentState.currentChapter) {
        throw new Error("Missing current chapter in state");
      }

      const updatedChapter: Chapter = {
        ...input.currentState.currentChapter,
        content: input.response,
        status: "completed",
        phase: RESEARCH_PHASES.CHAPTER_WRITING,
      };

      // Update the chapter in the chapters map
      const updatedChapters = {
        ...input.currentState.chapters,
        [updatedChapter.title]: updatedChapter,
      };

      // Update progress
      const updatedProgress = {
        ...input.currentState.progress,
        completedChapters: input.currentState.progress.completedChapters + 1,
      };

      return {
        ...input.currentState,
        currentChapterTitle: null,
        chapters: updatedChapters,
        progress: updatedProgress,
      };
    },
  });

  return RunnableSequence.from([
    prepareData,
    {
      response: new RunnableLambda({ func: (x: PrepareOutput) => x }),
      generated: prompt.pipe(model).pipe(parser),
    },
    addState,
    processResponse,
  ]);
}
