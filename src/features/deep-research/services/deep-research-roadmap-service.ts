import { ResearchService } from './research-service';
import { 
  ResearchRequest,
  ResearchState,
  RESEARCH_PHASES
} from '../types/research';
import { GraphService } from '@/shared/services/firebase/graph-service';
import {
  generatePlaceholderNodesFromChapters,
  generateSubtopicNodesForChapter,
  updateCompletedChapter,
  NodeGenerationOptions
} from '../utils/node-generation-utils';
import { useDeepResearchRoadmapStore } from '../stores/deep-research-roadmap-store';
import { NodeStatus } from '@/shared/types/node';
import { SubTopic } from '../types/research';

export interface RoadmapGenerationInput {
  rootNodeId: string;
  rootNodePosition: { x: number; y: number };
  rootNodeTitle: string;
  graphId: string;
  graphName: string;
  graphPosition: { x: number; y: number };
  numberOfChapters: number;
  userId: string;
}

export class DeepResearchRoadmapService {
  private researchService: ResearchService;
  private graphService: GraphService;
  private abortController: AbortController | null = null;
  
  constructor(userId: string) {
    this.researchService = new ResearchService();
    this.graphService = new GraphService(userId);
  }
  
  async generateRoadmap(input: RoadmapGenerationInput): Promise<void> {
    const store = useDeepResearchRoadmapStore.getState();
    
    // Reset store state
    store.reset();
    store.setIsLoading(true);
    
    // Create abort controller
    this.abortController = new AbortController();
    
    try {
      // Start research
      const request: ResearchRequest = {
        query: input.rootNodeTitle,
        numberOfChapters: input.numberOfChapters
      };
      
      let lastState: ResearchState | null = null;
      let nodesCreated = false;
      
      // Options for node generation
      const nodeOptions: NodeGenerationOptions = {
        parentNodeId: input.rootNodeId,
        parentNodePosition: input.rootNodePosition,
        graphId: input.graphId,
        graphName: input.graphName,
        graphPosition: input.graphPosition
      };
      
      // Process research events
      for await (const event of this.researchService.startResearch(request)) {
        // Check if canceled
        if (store.cancelRequested) {
          this.abortController.abort();
          break;
        }
        
        // Update session ID in store if not set
        if (!store.sessionId && event.sessionId) {
          store.setSessionId(event.sessionId);
        }
        
        // Handle different event types
        if (event.type === 'error') {
          store.setError(event.error);
          break;
        }
        
        if (event.type === 'progress' && event.chapters.length > 0) {
          // We can infer the state from the event data
          const inferredState: ResearchState = {
            researchSubject: input.rootNodeTitle,
            numberOfChapters: input.numberOfChapters,
            initialResearch: { queries: [], results: [] },
            plannedChapters: event.chapters,
            chapters: event.chapters.reduce((acc, chapter) => {
              acc[chapter.title] = chapter;
              return acc;
            }, {} as Record<string, typeof event.chapters[0]>),
            chapterOrder: event.chapters.map(chapter => chapter.title),
            currentChapterTitle: event.chapters.find(c => 
              c.status === 'researching' || c.status === 'writing'
            )?.title || null,
            currentPhase: event.phase,
            progress: {
              totalChapters: event.chapters.length,
              completedChapters: event.chapters.filter(c => c.status === 'completed').length
            }
          };
          
          lastState = inferredState;
          store.setResearchState(inferredState);
          
          // Calculate and update progress
          const progress = this.calculateProgress(inferredState);
          store.setProgress(progress);
          store.setCurrentPhaseLabel(this.getPhaseLabel(inferredState));
          
          // Handle different research phases
          if (inferredState.currentPhase === RESEARCH_PHASES.PLANNING && !nodesCreated) {
            // Create placeholder nodes for planned chapters
            await this.createPlaceholderNodes(inferredState, nodeOptions);
            nodesCreated = true;
          } else if (inferredState.currentPhase === RESEARCH_PHASES.CHAPTER_WRITING && inferredState.currentChapterTitle) {
            // Update chapter nodes and create subtopic nodes
            await this.updateChapterAndCreateSubtopics(inferredState, nodeOptions);
          }
        }
        
        // Handle final output
        if (event.isFinalOutput) {
          store.setProgress(100);
          store.setCurrentPhaseLabel('Research Complete');
          break;
        }
      }
      
      // Make sure final phase is marked as complete
      if (lastState && lastState.currentPhase === RESEARCH_PHASES.COMPLETE) {
        store.setProgress(100);
        store.setCurrentPhaseLabel('Research Complete');
      }
      
      // Set loading to false
      store.setIsLoading(false);
      
    } catch (error) {
      // Handle errors
      console.error('Error in research roadmap generation:', error);
      store.setError(error instanceof Error ? error.message : 'An error occurred');
      store.setIsLoading(false);
    } finally {
      this.abortController = null;
    }
  }
  
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
  
  private async createPlaceholderNodes(
    state: ResearchState,
    options: NodeGenerationOptions
  ): Promise<void> {
    const store = useDeepResearchRoadmapStore.getState();
    
    // Generate placeholder nodes for planned chapters
    const chapters = Object.values(state.chapters);
    const { reactFlowNodes, dbNodes, dbEdges } = 
      generatePlaceholderNodesFromChapters(chapters, options);
    
    // Save generated node IDs in store
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const nodeId = reactFlowNodes[i].id;
      store.addGeneratedNodeId(chapter.title, nodeId);
    }
    
    // Create subtopic nodes for each chapter right after creating chapter nodes
    // This is a critical change - we're creating ALL subtopic nodes immediately
    const subtopicPromises = chapters.map(async (chapter, index) => {
      try {
        // Get the node ID for this chapter
        const chapterNodeId = reactFlowNodes[index].id;
        const chapterPosition = reactFlowNodes[index].position;
        
        // Create placeholder subtopic nodes based on the chapter's subtopic names
        if (chapter.subTopicNames && chapter.subTopicNames.length > 0) {
          // Create a placeholder chapter with subtopics
          const placeholderSubTopics: Record<string, SubTopic> = {};
          
          // Create placeholder content for each subtopic
          chapter.subTopicNames.forEach(name => {
            placeholderSubTopics[name] = {
              title: name,
              description: `Subtopic of ${chapter.title}`,
              content: '',
              sources: []
            };
          });
          
          // Create a placeholder chapter with content for the subtopics
          const placeholderChapter = {
            ...chapter,
            content: {
              overview: chapter.description || '',
              subTopics: placeholderSubTopics
            }
          };
          
          // Generate subtopic nodes
          const { reactFlowNodes: subtopicNodes, dbNodes: subtopicDbNodes, dbEdges: subtopicDbEdges } = 
            generateSubtopicNodesForChapter(
              placeholderChapter,
              chapterNodeId,
              chapterPosition,
              options.graphId,
              options.graphName,
              options.graphPosition,
              index
            );
          
          // Save subtopic node IDs in store
          chapter.subTopicNames.forEach((subTopicName, i) => {
            if (i < subtopicNodes.length) {
              const subtopicNodeId = subtopicNodes[i].id;
              store.addGeneratedSubtopicId(chapter.title, subTopicName, subtopicNodeId);
            }
          });
          
          // Save to database
          await Promise.all([
            ...subtopicDbNodes.map(node => this.graphService.createNode(options.graphId, node)),
            ...subtopicDbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
          ]);
        }
      } catch (error) {
        console.error(`Error creating subtopic nodes for chapter ${chapter.title}:`, error);
      }
    });
    
    // Save chapter nodes to database
    try {
      await Promise.all([
        ...dbNodes.map(node => this.graphService.createNode(options.graphId, node)),
        ...dbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
      ]);
      
      // After chapter nodes are saved, create all subtopic nodes
      await Promise.all(subtopicPromises);
      
    } catch (error) {
      console.error('Error saving placeholder nodes:', error);
      store.setError('Failed to save placeholder nodes');
    }
  }
  
  private async updateChapterAndCreateSubtopics(
    state: ResearchState,
    options: NodeGenerationOptions
  ): Promise<void> {
    const store = useDeepResearchRoadmapStore.getState();
    
    // Find current chapter
    const currentChapterTitle = state.currentChapterTitle;
    if (!currentChapterTitle) return;
    
    const chapter = state.chapters[currentChapterTitle];
    if (!chapter || !chapter.content) return;
    
    // Get node ID for this chapter
    const nodeId = store.generatedNodeIds[currentChapterTitle];
    if (!nodeId) return;
    
    // Debug log to see what we're working with
    console.log('Updating chapter:', currentChapterTitle);
    console.log('Chapter data:', JSON.stringify({
      title: chapter.title,
      status: chapter.status,
      hasContent: !!chapter.content,
      contentKeys: chapter.content ? Object.keys(chapter.content) : [],
      hasResearch: !!chapter.research,
      resultsCount: chapter.research?.results?.length || 0,
      queriesCount: chapter.research?.queries?.length || 0,
      subTopicCount: chapter.content?.subTopics ? Object.keys(chapter.content.subTopics).length : 0
    }));
    
    // Update chapter node with completed content
    const chapterUpdate = updateCompletedChapter(chapter);
    
    // Debug log to check what data the system is actually reading
    console.log(`Checking node fields in updateChapterAndCreateSubtopics:`, {
      nodeId,
      fieldsInContent: Object.keys(chapterUpdate.content || {}),
      chapterTitle: chapter.title,
      hasResourcesArray: Array.isArray(chapterUpdate.content?.resources),
      resourcesCount: (chapterUpdate.content?.resources as { title: string; url: string; type: string }[] || []).length
    });
    
    try {
      // Update chapter node with completed content
      await this.graphService.updateNode(options.graphId, nodeId, chapterUpdate);
      console.log(`Updated chapter node ${nodeId} for ${currentChapterTitle}`);
      
      // Update subtopic nodes with real content, don't create new ones
      if (chapter.content.subTopics) {
        const subTopicNames = Object.keys(chapter.content.subTopics);
        console.log(`Found ${subTopicNames.length} subtopics to update`);
        
        // Update each subtopic node with the completed content
        for (const subTopicName of subTopicNames) {
          // Get the subtopic node ID from the store
          const subtopicNodeId = store.generatedSubtopicIds[currentChapterTitle]?.[subTopicName];
          if (!subtopicNodeId) {
            console.warn(`No node ID found for subtopic ${subTopicName} of chapter ${currentChapterTitle}`);
            continue;
          }
          
          const subTopic = chapter.content.subTopics[subTopicName];
          console.log(`Updating subtopic: ${subTopicName}`, JSON.stringify({
            title: subTopic.title,
            description: subTopic.description?.substring(0, 50) || '(no description)',
            contentLength: subTopic.content?.length || 0,
            sourcesCount: subTopic.sources?.length || 0
          }));
          
          // Find any research results specifically for this subtopic
          const subtopicResults = chapter.research?.results?.filter(
            result => result.targetSubTopic === subTopicName
          ) || [];
          
          // Find any research queries specifically for this subtopic
          const subtopicQueries = chapter.research?.queries?.filter(
            query => query.targetSubTopic === subTopicName
          ).map(q => q.query) || [];
          
          console.log(`Found ${subtopicResults.length} results and ${subtopicQueries.length} queries for subtopic ${subTopicName}`);
          
          // Prepare the main text content with queries included
          let mainTextContent = subTopic.content || '';
          if (subtopicQueries.length > 0) {
            const queriesText = subtopicQueries.join('\n');
            mainTextContent = `${mainTextContent}\n\nResearch Queries:\n${queriesText}`;
          }
          
          // Create the update for the subtopic node
          const subtopicUpdate = {
            properties: {
              title: subTopic.title,
              description: subTopic.description || '',
              type: 'concept'
            },
            content: {
              mainText: mainTextContent,
              resources: [
                // Include subtopic-specific sources
                ...(subTopic.sources?.map(src => ({
                  title: src.title,
                  url: src.url,
                  type: 'link'
                })) || []),
                // Include subtopic-specific research results
                ...subtopicResults.map(result => ({
                  title: result.title,
                  url: result.url,
                  type: 'link'
                }))
              ],
              // Store research queries directly in the content
              researchQueries: subtopicQueries
            },
            metadata: {
              status: 'active' as NodeStatus,
              tags: []
            }
          };
          
          // Log the update we're about to make
          console.log(`Updating subtopic node ${subtopicNodeId} with data length: ${
            JSON.stringify(subtopicUpdate).length
          } characters`);
          
          // Update the subtopic node in the database
          await this.graphService.updateNode(options.graphId, subtopicNodeId, subtopicUpdate);
          console.log(`Successfully updated subtopic node ${subtopicNodeId} for ${subTopicName}`);
        }
      }
    } catch (error) {
      console.error('Error updating chapter or subtopic content:', error);
    }
  }
  
  private calculateProgress(state: ResearchState): number {
    if (!state) return 0;
    
    switch(state.currentPhase) {
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 10;
      
      case RESEARCH_PHASES.PLANNING:
        return 20;
      
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
      case RESEARCH_PHASES.CHAPTER_WRITING: {
        if (state.progress.totalChapters === 0) return 20;
        const completedPercentage = state.progress.completedChapters / state.progress.totalChapters;
        // Scale from 20% to 90% based on chapter completion
        return 20 + (completedPercentage * 70);
      }
      
      case RESEARCH_PHASES.COMPLETE:
        return 100;
        
      default:
        return 0;
    }
  }
  
  private getPhaseLabel(state: ResearchState): string {
    if (!state) return 'Initializing';
    
    switch(state.currentPhase) {
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 'Researching Topic';
      
      case RESEARCH_PHASES.PLANNING:
        return 'Planning Chapters';
      
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
        return `Researching Chapter: ${state.currentChapterTitle || ''}`;
      
      case RESEARCH_PHASES.CHAPTER_WRITING:
        return `Writing Chapter: ${state.currentChapterTitle || ''}`;
      
      case RESEARCH_PHASES.COMPLETE:
        return 'Research Complete';
        
      default:
        return 'Processing';
    }
  }
} 