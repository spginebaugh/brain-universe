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
  // Add local tracking of node IDs to avoid relying solely on the store
  private generatedNodeIds: Record<string, string> = {};
  private generatedSubtopicIds: Record<string, Record<string, string>> = {};
  
  constructor(userId: string) {
    this.researchService = new ResearchService();
    this.graphService = new GraphService(userId);
  }
  
  // Utility function to sanitize data before sending to Firestore
  // Removes any properties with undefined values that would cause Firebase to reject the update
  private sanitizeFirestoreData<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = { ...obj } as Record<string, unknown>;
    
    // Recursively clean each property
    Object.keys(result).forEach(key => {
      const value = result[key];
      
      // Remove undefined values
      if (value === undefined) {
        delete result[key];
      } 
      // Recursively sanitize objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeFirestoreData(value as Record<string, unknown>);
        
        // If object became empty after sanitization, use empty object instead of undefined
        if (Object.keys(result[key] as object).length === 0) {
          result[key] = {};
        }
      }
      // Sanitize arrays
      else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeFirestoreData(item) : item
        ).filter(item => item !== undefined);
      }
    });
    
    return result as unknown as T;
  }
  
  async generateRoadmap(input: RoadmapGenerationInput): Promise<void> {
    const store = useDeepResearchRoadmapStore.getState();
    
    // Reset store state
    store.reset();
    store.setIsLoading(true);
    
    // Reset local tracking
    this.generatedNodeIds = {};
    this.generatedSubtopicIds = {};
    
    // Create abort controller
    this.abortController = new AbortController();
    
    try {
      // Start research
      const request: ResearchRequest = {
        query: input.rootNodeTitle,
        numberOfChapters: input.numberOfChapters
      };
      
      let finalResearchState: ResearchState | null = null;
      
      // Options for node generation
      const nodeOptions: NodeGenerationOptions = {
        parentNodeId: input.rootNodeId,
        parentNodePosition: input.rootNodePosition,
        graphId: input.graphId,
        graphName: input.graphName,
        graphPosition: input.graphPosition
      };
      
      // Process research events but don't create nodes yet
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
          
          // Update the state in the store
          finalResearchState = inferredState;
          store.setResearchState(inferredState);
          
          // Calculate and update progress
          const progress = this.calculateProgress(inferredState);
          store.setProgress(progress);
          store.setCurrentPhaseLabel(this.getPhaseLabel(inferredState));
        }
        
        // Handle final output - this is where we'll create all nodes once research is complete
        if (event.isFinalOutput && finalResearchState) {
          store.setProgress(100);
          store.setCurrentPhaseLabel('Research Complete');
          
          // Now that research is complete, create all the nodes at once
          await this.createAllNodesWithCompleteData(finalResearchState, nodeOptions);
          break;
        }
      }
      
      // Make sure final phase is marked as complete
      if (finalResearchState && finalResearchState.currentPhase === RESEARCH_PHASES.COMPLETE) {
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
  
  // New method to create all nodes with complete data at once
  private async createAllNodesWithCompleteData(
    state: ResearchState,
    options: NodeGenerationOptions
  ): Promise<void> {
    const store = useDeepResearchRoadmapStore.getState();
    console.log('Creating all nodes with complete data...');
    
    try {
      // 1. First create all chapter nodes
      const chapters = Object.values(state.chapters);
      const { reactFlowNodes, dbNodes, dbEdges } = 
        generatePlaceholderNodesFromChapters(chapters, options);
      
      // Store node IDs for later reference - both in store and locally
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const nodeId = reactFlowNodes[i].id;
        
        // Store in Zustand store
        store.addGeneratedNodeId(chapter.title, nodeId);
        
        // Store locally for redundancy
        this.generatedNodeIds[chapter.title] = nodeId;
        
        console.log(`Stored node ID for chapter "${chapter.title}": ${nodeId}`);
      }
      
      // 2. Save chapter nodes to database
      const chapterNodePromises = [
        ...dbNodes.map(node => this.graphService.createNode(options.graphId, node)),
        ...dbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
      ];
      
      await Promise.all(chapterNodePromises);
      console.log(`Created ${dbNodes.length} chapter nodes and ${dbEdges.length} edges`);
      
      // Verify our chapter node IDs are stored correctly
      console.log('Stored chapter node IDs after creation:', JSON.stringify(this.generatedNodeIds));
      
      // 3. Now create all subtopic nodes
      const subtopicPromises: Promise<void>[] = [];
      
      for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
        const chapter = chapters[chapterIndex];
        const chapterNodeId = this.generatedNodeIds[chapter.title]; // Use local tracking
        
        if (!chapterNodeId) {
          console.warn(`No node ID found for chapter ${chapter.title} in local tracking`);
          continue;
        }
        
        const chapterPosition = reactFlowNodes[chapterIndex].position;
        
        if (chapter.content?.subTopics && Object.keys(chapter.content.subTopics).length > 0) {
          // Prepare storage for subtopics for this chapter
          if (!this.generatedSubtopicIds[chapter.title]) {
            this.generatedSubtopicIds[chapter.title] = {};
          }
          
          // Generate subtopic nodes with complete data
          const { reactFlowNodes: subtopicNodes, dbNodes: subtopicDbNodes, dbEdges: subtopicDbEdges } = 
            generateSubtopicNodesForChapter(
              chapter,
              chapterNodeId,
              chapterPosition,
              options.graphId,
              options.graphName,
              options.graphPosition,
              chapterIndex
            );
          
          // Store subtopic node IDs - both in store and locally
          const subTopicNames = Object.keys(chapter.content.subTopics);
          subTopicNames.forEach((subTopicName, i) => {
            if (i < subtopicNodes.length) {
              const subtopicNodeId = subtopicNodes[i].id;
              
              // Store in Zustand store
              store.addGeneratedSubtopicId(chapter.title, subTopicName, subtopicNodeId);
              
              // Store locally for redundancy
              if (!this.generatedSubtopicIds[chapter.title]) {
                this.generatedSubtopicIds[chapter.title] = {};
              }
              this.generatedSubtopicIds[chapter.title][subTopicName] = subtopicNodeId;
              
              console.log(`Stored node ID for subtopic "${subTopicName}" of chapter "${chapter.title}": ${subtopicNodeId}`);
            }
          });
          
          // Create a promise to save subtopic nodes and edges
          const subtopicPromise = async () => {
            try {
              await Promise.all([
                ...subtopicDbNodes.map(node => this.graphService.createNode(options.graphId, node)),
                ...subtopicDbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
              ]);
              console.log(`Created ${subtopicDbNodes.length} subtopic nodes for chapter "${chapter.title}"`);
            } catch (error) {
              console.error(`Error creating subtopic nodes for chapter "${chapter.title}":`, error);
            }
          };
          
          subtopicPromises.push(subtopicPromise());
        }
      }
      
      // 4. Wait for all subtopic nodes to be created
      await Promise.all(subtopicPromises);
      
      // Verify our subtopic node IDs are stored correctly
      console.log('Stored subtopic node IDs after creation:', JSON.stringify(this.generatedSubtopicIds));
      
      // 5. Now update all chapter nodes with complete content
      const chapterUpdatePromises = chapters.map(async (chapter) => {
        try {
          // Try to get the node ID from our local tracking first, then fall back to the store
          let nodeId = this.generatedNodeIds[chapter.title];
          if (!nodeId) {
            nodeId = store.generatedNodeIds[chapter.title];
            console.log(`Retrieved node ID from store for chapter "${chapter.title}": ${nodeId}`);
          }
          
          if (!nodeId) {
            console.warn(`No node ID found for chapter ${chapter.title}`);
            return;
          }
          
          // Update the chapter node with complete content
          const chapterUpdate = updateCompletedChapter(chapter);
          
          // Sanitize update data to remove any undefined values
          const sanitizedUpdate = this.sanitizeFirestoreData(chapterUpdate);
          console.log(`Sanitized update for chapter "${chapter.title}"`, 
            JSON.stringify({
              beforeKeys: Object.keys(chapterUpdate),
              afterKeys: Object.keys(sanitizedUpdate)
            })
          );
          
          await this.graphService.updateNode(options.graphId, nodeId, sanitizedUpdate);
          console.log(`Updated chapter node ${nodeId} for ${chapter.title} with complete content`);
        } catch (error) {
          console.error(`Error updating chapter node for ${chapter.title}:`, error);
        }
      });
      
      await Promise.all(chapterUpdatePromises);
      console.log('All chapter nodes updated with complete content');
      
      // 6. Finally, update all subtopic nodes with complete content
      const subtopicUpdatePromises: Promise<void>[] = [];
      
      for (const chapter of chapters) {
        if (!chapter.content?.subTopics) continue;
        
        const subTopicNames = Object.keys(chapter.content.subTopics);
        for (const subTopicName of subTopicNames) {
          const subtopicPromise = async () => {
            try {
              // Try to get the subtopic node ID from our local tracking first, then fall back to the store
              let subtopicNodeId = this.generatedSubtopicIds[chapter.title]?.[subTopicName];
              if (!subtopicNodeId) {
                subtopicNodeId = store.generatedSubtopicIds[chapter.title]?.[subTopicName];
                console.log(`Retrieved node ID from store for subtopic "${subTopicName}" of chapter "${chapter.title}": ${subtopicNodeId}`);
              }
              
              if (!subtopicNodeId) {
                console.warn(`No node ID found for subtopic ${subTopicName} of chapter ${chapter.title}`);
                return;
              }
              
              const subTopic = chapter.content!.subTopics[subTopicName];
              
              // Find results and queries for this subtopic
              const subtopicResults = chapter.research?.results?.filter(
                result => result.targetSubTopic === subTopicName
              ) || [];
              
              const subtopicQueries = chapter.research?.queries?.filter(
                query => query.targetSubTopic === subTopicName
              ) || [];
              
              // Create the update for the subtopic node
              const subtopicUpdate = {
                properties: {
                  title: subTopic.title,
                  description: subTopic.description || '',
                  type: 'concept'
                },
                content: {
                  mainText: subTopic.content || '',
                  resources: [] as Array<{title: string; url: string; type: string}>,
                  researchQueries: subtopicQueries.filter(q => q.query).map(q => q.query || '')
                },
                metadata: {
                  status: 'active' as NodeStatus,
                  tags: []
                }
              };
              
              // Add sources as resources
              if (subTopic.sources && subTopic.sources.length > 0) {
                for (const src of subTopic.sources) {
                  if (src.title && src.url) {
                    subtopicUpdate.content.resources.push({
                      title: src.title,
                      url: src.url,
                      type: 'link'
                    });
                  }
                }
              }
              
              // Add research results as resources
              if (subtopicResults.length > 0) {
                for (const result of subtopicResults) {
                  if (result.title && result.url) {
                    subtopicUpdate.content.resources.push({
                      title: result.title,
                      url: result.url,
                      type: 'link'
                    });
                  }
                }
              }
              
              // Add research queries in a structured format
              if (subtopicQueries.length > 0) {
                const queriesText = subtopicQueries
                  .filter(q => q.purpose && q.query)
                  .map(q => `${q.purpose}: ${q.query || ''}`)
                  .join('\n');
                
                // Append queries to mainText in a structured way
                if (queriesText && subtopicUpdate.content.mainText) {
                  subtopicUpdate.content.mainText += '\n\n## Research Queries\n' + queriesText;
                }
              }
              
              // Sanitize update data to remove any undefined values
              const sanitizedUpdate = this.sanitizeFirestoreData(subtopicUpdate);
              
              // Update the subtopic node
              await this.graphService.updateNode(options.graphId, subtopicNodeId, sanitizedUpdate);
              console.log(`Updated subtopic node ${subtopicNodeId} for ${subTopicName} with complete content`);
            } catch (error) {
              console.error(`Error updating subtopic node for ${subTopicName}:`, error);
            }
          };
          
          subtopicUpdatePromises.push(subtopicPromise());
        }
      }
      
      await Promise.all(subtopicUpdatePromises);
      console.log('All subtopic nodes updated with complete content');
      
    } catch (error) {
      console.error('Error creating nodes with complete data:', error);
      store.setError('Failed to create nodes with complete data');
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