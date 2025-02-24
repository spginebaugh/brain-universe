import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState, Chapter, ChapterContent, RESEARCH_PHASES } from '../../../types/research';

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
- The provided sub-topic names
- A brief description of the sub-topic
- Content section. This should be an in-depth lesson about the sub-topic topic (at least 1000 words).
    - Aim for factual accuracy and academic tone
    - Go into depth about the sub-topic topic
    - Write in a way that will provide readers a deep understanding of the topic
- At least one relevant source with title and URL

IMPORTANT: Format your response as a valid JSON object with the following structure:
{{
  "overview": "string containing 100-150 word overview",
  "subTopics": {{
    "subTopicName1": {{
      "title": "string",
      "description": "string",
      "content": "string",
      "sources": [
        {{
          "title": "string",
          "url": "string"
        }}
      ]
    }},
    "subTopicName2": {{
      "title": "string",
      "description": "string",
      "content": "string",
      "sources": [
        {{
          "title": "string",
          "url": "string"
        }}
      ]
    }}
  }}
}}

Make sure to:
1. Use proper JSON syntax with double quotes around all keys and string values
2. Escape any double quotes within string values using backslash (\\")
3. Avoid trailing commas
4. Ensure all opening brackets/braces have matching closing brackets/braces
5. Do not include any text, markdown, or explanations outside the JSON structure`

// Define additional types for internal state management
interface WriteStateExtension {
  currentChapter?: Chapter;
  sourceStr?: string;
}

type ExtendedResearchState = ResearchState & WriteStateExtension;

export function writeSectionNode(model: ChatOpenAI) {
  type PrepareOutput = {
    chapterTitle: string;
    chapterDescription: string;
    subTopicNames: string;
    sourceData: string;
    currentState: ExtendedResearchState;
  };

  const prompt = PromptTemplate.fromTemplate<PrepareOutput>(WRITE_CHAPTER_TEMPLATE);
  const jsonParser = new JsonOutputParser<ChapterContent>();

  const prepareData = new RunnableLambda({
    func: (state: ExtendedResearchState) => {
      if (!state.currentChapter) {
        throw new Error('Missing chapter in state');
      }
      
      if (!state.sourceStr) {
        throw new Error('Missing source data in state');
      }

      return {
        chapterTitle: state.currentChapter.title,
        chapterDescription: state.currentChapter.description,
        subTopicNames: state.currentChapter.subTopicNames.join(', '),
        sourceData: state.sourceStr,
        currentState: state
      };
    }
  });

  // Transform the model output to include state
  const addState = new RunnableLambda({
    func: (input: { response: PrepareOutput; generated: ChapterContent }) => ({
      response: input.generated,
      currentState: input.response.currentState
    })
  });

  const processResponse = new RunnableLambda({
    func: (input: { response: ChapterContent; currentState: ExtendedResearchState }) => {
      console.log('Processing chapter content response:', input.response);
      
      // Validate the content structure
      if (!input.response || typeof input.response !== 'object') {
        console.error('Invalid chapter content response:', input.response);
        throw new Error('Invalid chapter content response: not an object');
      }
      
      if (!input.response.overview) {
        console.warn('Missing overview in chapter content:', input.response);
        // Set default overview if missing
        input.response.overview = `Chapter overview for ${input.currentState.currentChapter?.title}`;
      }
      
      if (!input.response.subTopics || typeof input.response.subTopics !== 'object') {
        console.warn('Missing or invalid subTopics in chapter content:', input.response);
        // Create default subTopics structure if missing
        input.response.subTopics = {};
        
        // Add dummy content for each subTopic named in the chapter
        if (input.currentState.currentChapter?.subTopicNames) {
          input.currentState.currentChapter.subTopicNames.forEach((name: string) => {
            input.response.subTopics[name] = {
              title: name,
              description: `Description for ${name}`,
              content: `Default content for ${name}`,
              sources: []
            };
          });
        }
      }
      
      // Ensure currentChapter exists
      if (!input.currentState.currentChapter) {
        throw new Error('Missing current chapter in state');
      }
      
      const updatedChapter: Chapter = {
        ...input.currentState.currentChapter,
        content: input.response,
        status: 'completed',
        phase: RESEARCH_PHASES.CHAPTER_WRITING
      };

      // Update the chapter in the chapters map
      const updatedChapters = {
        ...input.currentState.chapters,
        [updatedChapter.title]: updatedChapter
      };

      // Update progress
      const updatedProgress = {
        ...input.currentState.progress,
        completedChapters: input.currentState.progress.completedChapters + 1
      };

      return {
        ...input.currentState,
        currentChapterTitle: null,
        chapters: updatedChapters,
        progress: updatedProgress
      };
    }
  });

  return RunnableSequence.from([
    prepareData,
    {
      response: new RunnableLambda({ func: (x: PrepareOutput) => x }),
      generated: prompt.pipe(model).pipe(jsonParser)
    },
    addState,
    processResponse
  ]);
} 