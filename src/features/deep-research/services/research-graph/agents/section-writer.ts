import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AgentInput, AgentOutput, SectionContentSchema } from './types';

const SECTION_WRITER_TEMPLATE = `You are an expert technical teacher crafting a detailed lesson for one section of a learning roadmap.

<Section topic>
{sectionTopic}
</Section topic>

<Subsection titles>
{subsectionTitles}
</Subsection titles>

<Source material>
{context}
</Source material>

<Task>
Write a comprehensive section with an overview and detailed subsections based on the provided information.

Requirements:
1. Overview must be 100-150 words and provide a clear summary of the section
2. Each subsection must include:
   - A clear title matching one from the provided subsection titles
   - A brief description of the topics covered
   - Detailed content (150-200 words)
   - At least one relevant source with title and URL
3. Content should be:
   - Technical and accurate
   - Written in simple, clear language
   - Start with the most important insight in **bold**
   - Use short paragraphs (2-3 sentences max)
4. You may include ONE structural element per subsection:
   - Either a focused table comparing 2-3 key items
   - Or a short list (3-5 items)`;

export const sectionWriterAgent = async (input: AgentInput): Promise<AgentOutput> => {
  const { state, model } = input;
  const steps: AgentOutput['steps'] = [];

  if (!state.section) {
    throw new Error('No section provided for content generation');
  }

  const prompt = PromptTemplate.fromTemplate(SECTION_WRITER_TEMPLATE);
  const chain = RunnableSequence.from([
    prompt,
    model.withStructuredOutput(SectionContentSchema, {
      name: "SectionContentGenerator",
      strict: true
    })
  ]);

  const result = await chain.invoke({
    sectionTopic: state.section.title,
    subsectionTitles: state.section.subsectionTitles.join('\n'),
    context: state.sourceStr || ''
  });

  steps.push({
    agentName: 'Section Writer',
    thought: `Writing content for section: ${state.section.title}`,
    action: 'Generating section content',
    observation: `Generated content with overview and ${Object.keys(result.subsections).length} subsections`
  });

  // Update the section with the new content
  const updatedSection = {
    ...state.section,
    content: result
  };

  // Add to completed sections
  const completedSections = [
    ...(state.completedSections || []),
    updatedSection
  ];

  return {
    state: {
      section: null, // Clear current section
      completedSections,
      searchIterations: 0, // Reset search iterations
      searchQueries: [] // Reset search queries
    },
    steps
  };
}; 