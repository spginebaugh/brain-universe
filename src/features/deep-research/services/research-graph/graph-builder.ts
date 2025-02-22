import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ResearchConfig, Section } from '../../types/research';

// Node implementations will be imported from separate files
import { generatePlanNode } from './nodes/generate-plan';
import { webSearchNode } from './nodes/web-search';
import { writeSectionNode } from './nodes/write-section';

// Define state annotation
const ResearchStateAnnotation = Annotation.Root({
  topic: Annotation<string>({
    value: (left: string, right: string) => right,
    default: () => ''
  }),
  numberOfMainSections: Annotation<number>({
    value: (left: number, right: number) => right,
    default: () => 0
  }),
  sections: Annotation<Section[]>({
    value: (left: Section[], right: Section[]) => [...left, ...right],
    default: () => []
  }),
  section: Annotation<Section | null>({
    value: (left: Section | null, right: Section | null) => right,
    default: () => null
  }),
  searchIterations: Annotation<number>({
    value: (left: number, right: number) => right,
    default: () => 0
  }),
  searchQueries: Annotation<string[]>({
    value: (left: string[], right: string[]) => [...left, ...right],
    default: () => []
  }),
  sourceStr: Annotation<string>({
    value: (left: string, right: string) => right,
    default: () => ''
  }),
  completedSections: Annotation<Section[]>({
    value: (left: Section[], right: Section[]) => [...left, ...right],
    default: () => []
  }),
  reportSectionsFromResearch: Annotation<string>({
    value: (left: string, right: string) => right,
    default: () => ''
  })
});

type ResearchGraphState = typeof ResearchStateAnnotation.State;

export function buildResearchGraph(config: ResearchConfig) {
  // Initialize models with API keys
  const plannerModel = new ChatOpenAI({
    modelName: config.plannerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
  });

  const writerModel = new ChatOpenAI({
    modelName: config.writerModel,
    temperature: 0.7,
    openAIApiKey: config.openai.apiKey,
  });

  // Initialize tools with API keys
  const searchTool = new TavilySearchResults({
    apiKey: config.tavily.apiKey,
  });

  // Create the graph
  const graph = new StateGraph(ResearchStateAnnotation);

  // Add nodes
  const planNode = generatePlanNode(plannerModel);
  const researchNode = webSearchNode(searchTool);
  const writeNode = writeSectionNode(writerModel);

  graph
    .addNode('__start__', planNode)
    .addNode('research', researchNode)
    .addNode('write', writeNode)
    .addEdge('__start__', 'research')
    .addEdge('research', 'write')
    .addConditionalEdges(
      'write',
      (state: ResearchGraphState) => {
        if (state.completedSections.length < state.numberOfMainSections) {
          return 'research';
        }
        return END;
      }
    );

  return graph.compile();
} 