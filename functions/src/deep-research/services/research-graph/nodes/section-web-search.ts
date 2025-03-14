import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { ResearchState } from "../../../types/research";
import { SearchOutput } from "../../../types/parser-types";
import { OPENAI_API_KEY } from "../../../config";
// Define schema for structured output
const querySchema = z.object({
  query: z.string().describe("The search query to gather information for the chapter"),
  purpose: z.string().describe("The purpose of this query in researching the chapter"),
});

const queriesSchema = z.array(querySchema).describe("An array of search queries to gather comprehensive information for the chapter");

const SEARCH_QUERY_TEMPLATE = `You are an expert teacher crafting targeted web search queries that will gather comprehensive information for writing a detailed lesson for one chapter of a learning roadmap.:

Chapter Information:
Title: {chapterTitle}
Description: {chapterDescription}
SubTopics: {subTopicNames}

Generate {numberOfQueries} search queries that will help gather comprehensive information for writing this chapter.

Requirements:
1. Cover different aspects of the topic (e.g., core features, real-world applications, technical architecture)
2. Include specific technical terms related to the topic
3. Target recent information by including year markers where relevant (e.g., "2025")
4. Look for comparisons or differentiators from similar technologies/approaches
5. Search for both official documentation and practical implementation examples
6. Address each sub-topic name specifically to ensure comprehensive coverage

{format_instructions}`;

/**
 * Section web search node
 */
export function sectionWebSearchNode(searchTool: TavilySearchResults) {
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(queriesSchema);
  const formatInstructions = parser.getFormatInstructions();

  const queryPrompt = PromptTemplate.fromTemplate(SEARCH_QUERY_TEMPLATE);

  // Initialize a model for query generation
  const queryModel = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.7,
    apiKey: OPENAI_API_KEY.value(),
  });

  return RunnableSequence.from([
    // Extract chapter to research
    (state: ResearchState) => {
      // Find a chapter that hasn't been processed yet
      const nextChapter = state.plannedChapters.find((c) =>
        !state.chapters[c.title] || state.chapters[c.title].status === "pending",
      );

      if (!nextChapter) {
        throw new Error("No chapters left to research");
      }

      // Update chapter status to researching
      nextChapter.status = "researching";

      return {
        chapterTitle: nextChapter.title,
        chapterDescription: nextChapter.description,
        subTopicNames: nextChapter.subTopicNames.join(", "),
        numberOfQueries: 3,
        format_instructions: formatInstructions,
        chapter: nextChapter,
      };
    },
    // Generate search queries
    async (input) => {
      try {
        const queryChain = queryPrompt.pipe(queryModel).pipe(parser);
        const queries = await queryChain.invoke(input);

        if (!queries || !queries.length) {
          throw new Error("Generated search queries are empty");
        }

        return {
          ...input,
          queries: queries.map((q) => q.query),
        };
      } catch (error) {
        throw new Error(`Failed to generate search queries: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    // Perform search
    async (input) => {
      try {
        if (!input.queries || !input.queries.length) {
          throw new Error("Search queries are required");
        }

        const searchPromises = input.queries.map((query: string) =>
          searchTool.invoke(query),
        );

        const results = await Promise.all(searchPromises);

        if (!results || !results.length) {
          throw new Error("No search results returned");
        }

        const allResults = results.flatMap((resultStr) => {
          try {
            if (Array.isArray(resultStr) && resultStr.length > 0 && typeof resultStr[0] === "object") {
              return resultStr;
            }
            if (typeof resultStr === "string") {
              return JSON.parse(resultStr);
            }
            return [];
          } catch (error) {
            console.warn("Failed to parse search result:", error);
            return [];
          }
        });

        const validResults = allResults.filter((result) =>
          result &&
          typeof result === "object" &&
          typeof result.title === "string" && result.title.trim() &&
          typeof result.content === "string" && result.content.trim() &&
          typeof result.url === "string" && result.url.trim(),
        );

        if (!validResults.length) {
          throw new Error("No valid search results found after parsing");
        }

        const sourceStr = validResults
          .map((result) => `Source: ${result.title.trim()}\n${result.content.trim()}\nURL: ${result.url.trim()}`)
          .join("\n\n");

        const searchOutput: SearchOutput = {
          queries: input.queries,
          results: validResults.map((result) => ({
            title: result.title.trim(),
            content: result.content.trim(),
            url: result.url.trim(),
          })),
        };

        return {
          currentChapter: input.chapter,
          sourceStr,
          content: JSON.stringify(searchOutput),
        };
      } catch (error) {
        console.error("Search error:", error);

        if (error instanceof Error) {
          if (error.message.includes("400")) {
            throw new Error("Invalid search request. Please check your API key and query format.");
          } else if (error.message.includes("401")) {
            throw new Error("Invalid or expired Tavily API key.");
          } else if (error.message.includes("429")) {
            throw new Error("Rate limit exceeded. Please try again later.");
          }
        }

        throw new Error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
  ]);
}
