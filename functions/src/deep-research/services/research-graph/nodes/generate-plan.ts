import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { ResearchState, SearchResult } from "../../../types/research";
import { safeJsonStringify } from "../../../../utils";

/**
 * Define schema for structured output
 */
const chapterSchema = z.object({
  title: z.string().describe("The title of the chapter"),
  description: z.string().describe("A clear and concise description of the chapter"),
  subTopicNames: z.array(z.string()).length(6).describe("Exactly 6 sub-topic names that help organize the content"),
});

const chaptersSchema = z.array(chapterSchema).describe("An array of chapters that comprehensively cover the topic");

/**
 * Template for creating the plan using research
 */
const PLAN_TEMPLATE = `You are an expert technical writer helping to plan a learning roadmap for the topic: {researchSubject}

Using the following research context:
{researchContext}

Create {numberOfChapters} main chapters that would comprehensively cover this topic.
For each chapter:
1. Provide a clear title
2. Chapter descriptions should be clear and concise
3. List exactly 6 sub-topic names that would help organize the content

Ensure the chapters flow logically and cover the topic comprehensively using insights from the research.

{format_instructions}`;

/**
 * Generate plan node
 */
export function generatePlanNode(model: ChatOpenAI) {
  /**
   * Create structured output parser
   */
  const parser = StructuredOutputParser.fromZodSchema(chaptersSchema);
  const formatInstructions = parser.getFormatInstructions();
  const planPrompt = PromptTemplate.fromTemplate(PLAN_TEMPLATE);

  return RunnableSequence.from([
    /**
     * 1. Format research context
     */
    (state: ResearchState) => {
      const researchContext = (state.initialResearch.results || []).map((result: SearchResult) =>
        `${result.title}\n${result.content}\n${result.url}`,
      ).join("\n\n");

      return {
        researchSubject: state.researchSubject,
        numberOfChapters: state.numberOfChapters,
        researchContext,
        format_instructions: formatInstructions,
      };
    },

    /**
     * 2. Generate plan using research context
     */
    async (input) => {
      const planChain = planPrompt.pipe(model).pipe(parser);
      const chapters = await planChain.invoke(input);

      if (!Array.isArray(chapters)) {
        throw new Error("Chapters must be an array");
      }

      /**
       * 3. Add status property to each chapter
       */
      const chaptersWithStatus = chapters.map((chapter: any) => ({
        ...chapter,
        status: "pending" as const,
      }));

      chaptersWithStatus.forEach((chapter, index) => {
        if (!chapter.title || !chapter.description || !Array.isArray(chapter.subTopicNames)) {
          throw new Error(`Invalid chapter structure at index ${index}`);
        }
        if (chapter.subTopicNames.length !== 6) {
          throw new Error(`Chapter ${chapter.title} must have exactly 6 sub-topic names`);
        }
      });

      return {
        plannedChapters: chaptersWithStatus,
        completedChapters: [],
        currentChapter: null,
        content: safeJsonStringify({
          outline: {
            chapters: chaptersWithStatus.map((c: any) => ({
              title: c.title,
              description: c.description,
              subTopics: c.subTopicNames,
            })),
          },
        }),
      };
    },
  ]);
}
