import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ResearchState, Chapter, SearchResult } from '../../../types/research';

// Template for creating the plan using research
const PLAN_TEMPLATE = `You are an expert technical writer helping to plan a learning roadmap for the topic: {researchSubject}

Using the following research context:
{researchContext}

Create {numberOfChapters} main chapters that would comprehensively cover this topic.
For each chapter:
1. Provide a clear title
2. Chapter descriptions should be clear and concise
3. List exactly 6 sub-topic names that would help organize the content

Ensure the chapters flow logically and cover the topic comprehensively using insights from the research.

Format the response as a JSON array of chapters, where each chapter has:
- title: string
- description: string
- subTopicNames: string[]`;

export function generatePlanNode(model: ChatOpenAI) {
  const chapterJsonParser = new JsonOutputParser<Chapter[]>();
  const planPrompt = PromptTemplate.fromTemplate(PLAN_TEMPLATE);

  return RunnableSequence.from([
    // 1. Format research context
    (state: ResearchState) => {
      const researchContext = (state.initialResearch.results || []).map((result: SearchResult) => 
        `${result.title}\n${result.content}\n${result.url}`
      ).join('\n\n');

      return {
        researchSubject: state.researchSubject,
        numberOfChapters: state.numberOfChapters,
        researchContext
      };
    },

    // 2. Generate plan using research context
    async (input) => {
      const planChain = planPrompt.pipe(model).pipe(chapterJsonParser);
      const chapters = await planChain.invoke(input);

      if (!Array.isArray(chapters)) {
        throw new Error('Chapters must be an array');
      }
      
      chapters.forEach((chapter, index) => {
        if (!chapter.title || !chapter.description || !Array.isArray(chapter.subTopicNames)) {
          throw new Error(`Invalid chapter structure at index ${index}`);
        }
        if (chapter.subTopicNames.length !== 6) {
          throw new Error(`Chapter ${chapter.title} must have exactly 6 sub-topic names`);
        }
        
        // Set initial status for each chapter
        chapter.status = 'pending';
      });

      return {
        plannedChapters: chapters,
        completedChapters: [],
        currentChapter: null,
        content: JSON.stringify({
          outline: {
            chapters: chapters.map(c => ({
              title: c.title,
              description: c.description,
              subTopicNames: c.subTopicNames
            }))
          }
        })
      };
    }
  ]);
} 