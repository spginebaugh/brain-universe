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
import { NodeStatus, NodeMetadata } from '@/shared/types/node';

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
    // Use the existing researchService singleton from useResearch
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
    // Create an abort controller
    this.abortController = new AbortController();
    
    // Get a reference to the store
    const store = useDeepResearchRoadmapStore.getState();
    
    try {
      store.setIsLoading(true);
      store.setError(null);
      
      // Set initial progress
      store.setProgress(0);
      store.setCurrentPhaseLabel('Starting research...');
      
      // Create the research request
      const researchRequest: ResearchRequest = {
        query: input.rootNodeTitle,
        numberOfChapters: input.numberOfChapters
      };
      
      // Get the existing session ID from the store - this avoids creating a duplicate research session
      const useExistingSession = !!store.sessionId;
      let sessionId = store.sessionId;
      
      // If we don't have a session ID yet, start a new research process
      let lastState: ResearchState | null = null;
      
      if (!useExistingSession) {
        console.log('Creating new research session');
        // Set the session ID in the store
        for await (const event of this.researchService.startResearch(researchRequest)) {
          // Check if we've been cancelled
          if (this.abortController?.signal.aborted) {
            console.log('Research was cancelled');
            break;
          }
          
          // Update session ID if it was newly created
          if (!sessionId && event.sessionId) {
            sessionId = event.sessionId;
            store.setSessionId(sessionId);
            console.log('New research session created with ID:', sessionId);
          }
        
        if (event.type === 'progress') {
          const chapters = event.chapters;
          
          if (chapters && chapters.length > 0) {
            // Find the first chapter with content
            const completedChapters = chapters.filter(c => 
              c.status === 'completed' && c.content?.overview
            );
            
            // Create placeholder nodes for planning phase
            if (event.phase === RESEARCH_PHASES.PLANNING && chapters.length > 0) {
              // Create placeholder nodes for all chapters
              const options: NodeGenerationOptions = {
                parentNodeId: input.rootNodeId,
                parentNodePosition: input.rootNodePosition,
                graphId: input.graphId,
                graphName: input.graphName,
                graphPosition: input.graphPosition
              };
              
              const result = generatePlaceholderNodesFromChapters(chapters, options);
              
              // Store the node IDs for later reference
              result.dbNodes.forEach(node => {
                // Use type assertion to access custom metadata properties
                const metadata = node.metadata as NodeMetadata & { chapterTitle?: string };
                if (metadata.chapterTitle) {
                  // Use type assertion to access the node ID
                  const nodeId = (node as unknown as { nodeId: string }).nodeId;
                  this.generatedNodeIds[metadata.chapterTitle] = nodeId;
                }
              });
              
              store.setProgress(10); // Planning complete = 10% progress
              store.setCurrentPhaseLabel('Planning chapters...');
            }
            
            // For any completed chapters, create content nodes
            for (const chapter of completedChapters) {
              if (
                chapter.content &&
                !this.generatedSubtopicIds[chapter.title]
              ) {
                // Generate subtopic nodes
                const parentNodeId = this.generatedNodeIds[chapter.title] || input.rootNodeId;
                const parentPosition = { x: 0, y: 0 }; // Will be calculated properly
                
                const result = generateSubtopicNodesForChapter(
                  chapter,
                  parentNodeId,
                  parentPosition,
                  input.graphId,
                  input.graphName,
                  input.graphPosition
                );
                
                // Store subtopic node IDs
                result.dbNodes.forEach(node => {
                  // Use type assertion to access custom metadata properties
                  const metadata = node.metadata as NodeMetadata & { subtopicTitle?: string };
                  if (metadata.subtopicTitle && chapter.title) {
                    if (!this.generatedSubtopicIds[chapter.title]) {
                      this.generatedSubtopicIds[chapter.title] = {};
                    }
                    // Use type assertion to access the node ID
                    const nodeId = (node as unknown as { nodeId: string }).nodeId;
                    this.generatedSubtopicIds[chapter.title][metadata.subtopicTitle] = nodeId;
                  }
                });
                
                // Update the parent node's status to 'completed'
                const updatedNode = updateCompletedChapter(chapter);
                
                // Save the updated node to Firestore
                if (this.generatedNodeIds[chapter.title]) {
                  await this.graphService.updateNode(
                    input.graphId,
                    this.generatedNodeIds[chapter.title],
                    updatedNode
                  );
                }
              }
            }
          }
          
          // Extract state for progress calculation
          if (event.phase !== RESEARCH_PHASES.COMPLETE) {
            // Look through chapters to build a state object
            const state: ResearchState = {
              researchSubject: input.rootNodeTitle,
              numberOfChapters: input.numberOfChapters,
              plannedChapters: event.chapters,
              chapters: event.chapters.reduce((acc, chapter) => {
                acc[chapter.title] = chapter;
                return acc;
              }, {} as Record<string, typeof event.chapters[0]>),
              chapterOrder: event.chapters.map(c => c.title),
              currentChapterTitle: event.chapters.find(c => c.status === 'writing')?.title || null,
              currentPhase: event.phase,
              initialResearch: {
                queries: [],
                results: []
              },
              progress: {
                totalChapters: input.numberOfChapters,
                completedChapters: event.chapters.filter(c => c.status === 'completed').length
              }
            };
            
            lastState = state;
            
            // Update progress based on state
            const progress = this.calculateProgress(state);
            store.setProgress(progress);
            store.setCurrentPhaseLabel(this.getPhaseLabel(state));
          } else {
            // Research is complete
            store.setProgress(100);
            store.setCurrentPhaseLabel('Research complete!');
            store.setIsLoading(false);
          }
        } else if (event.type === 'error') {
          console.error('Research error:', event.error);
          store.setError(event.error);
          store.setIsLoading(false);
        }
      }
    } else {
      console.log('Using existing research session:', sessionId);
      // Just set progress and continue with node generation
      store.setProgress(50);
      store.setCurrentPhaseLabel('Processing research results...');
    }
      
      // If we have a complete state, create all the remaining nodes
      if (lastState) {
        await this.createAllNodesWithCompleteData(
          lastState,
          {
            parentNodeId: input.rootNodeId,
            parentNodePosition: input.rootNodePosition,
            graphId: input.graphId,
            graphName: input.graphName,
            graphPosition: input.graphPosition
          }
        );
      }
      
      // Final update
      store.setIsLoading(false);
      store.setProgress(100);
      store.setCurrentPhaseLabel('Research and graph generation complete!');
      
    } catch (error) {
      console.error('Error generating roadmap:', error);
      store.setError((error as Error).message);
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
              
              // Debug log to see what's happening with subtopics
              console.log(`Subtopic processing: ${subTopicName}`, {
                resultsFound: subtopicResults.length,
                allResults: chapter.research?.results?.length || 0,
                targetSubTopicsInResults: chapter.research?.results?.map(r => r.targetSubTopic).filter(Boolean),
                firstFewResults: chapter.research?.results?.slice(0, 2)
              });
              
              // If no specific subtopic results were found, consider all results that don't have a targetSubTopic
              // This helps when research results aren't properly tagged with the subtopic
              if (subtopicResults.length === 0 && chapter.research?.results) {
                // Find untargeted results or fallback to all results if needed
                const untargetedResults = chapter.research.results.filter(
                  result => !result.targetSubTopic || result.targetSubTopic === ''
                );
                
                // Only use untargeted results if we have a reasonable number (otherwise we'd duplicate them for all subtopics)
                if (untargetedResults.length > 0 && untargetedResults.length <= 3) {
                  console.log(`Using ${untargetedResults.length} untargeted results for subtopic ${subTopicName}`);
                  subtopicResults.push(...untargetedResults);
                } else {
                  // If we have many untargeted results, distribute them across subtopics
                  const subTopicCount = Object.keys(chapter.content!.subTopics).length;
                  const subTopicIndex = Object.keys(chapter.content!.subTopics).indexOf(subTopicName);
                  
                  if (subTopicCount > 0 && subTopicIndex >= 0) {
                    // Divide results among subtopics
                    const resultsPerSubtopic = Math.ceil(untargetedResults.length / subTopicCount);
                    const startIndex = subTopicIndex * resultsPerSubtopic;
                    const endIndex = Math.min(startIndex + resultsPerSubtopic, untargetedResults.length);
                    
                    // Assign a portion of the results to this subtopic
                    const assignedResults = untargetedResults.slice(startIndex, endIndex);
                    
                    if (assignedResults.length > 0) {
                      console.log(`Distributing ${assignedResults.length} results to subtopic ${subTopicName} (${startIndex}-${endIndex-1})`);
                      subtopicResults.push(...assignedResults);
                    }
                  }
                }
              }
              
              // Create the update for the subtopic node
              const subtopicUpdate = {
                properties: {
                  title: subTopic.title,
                  description: subTopic.description || '',
                  type: 'concept'
                },
                content: {
                  mainText: subTopic.content || '',
                  resources: [] as Array<{title: string; url: string; type: string; content?: string}>,
                  researchQueries: subtopicQueries.filter(q => q.query).map(q => q.query || '')
                },
                metadata: {
                  status: 'active' as NodeStatus,
                  tags: []
                }
              };
              
              // No research results at all? Try to share some content from the chapter
              if (subtopicResults.length === 0 && subtopicUpdate.content.mainText === '' && chapter.content?.overview) {
                // Use a portion of the chapter overview as content for this subtopic
                console.log(`Using chapter overview for empty subtopic ${subTopicName}`);
                subtopicUpdate.content.mainText = `# ${subTopicName}\n\nThis is part of the ${chapter.title} topic.\n\n${chapter.content.overview.substring(0, 150)}...\n`;
              }
              
              // Add sources as resources
              if (subTopic.sources && subTopic.sources.length > 0) {
                for (const src of subTopic.sources) {
                  if (src.title && src.url) {
                    subtopicUpdate.content.resources.push({
                      title: src.title,
                      url: src.url,
                      type: 'link',
                      content: '' // Add empty content for sources
                    });
                  }
                }
              }
              
              // Add research results as resources
              if (subtopicResults.length > 0) {
                for (const result of subtopicResults) {
                  if (result.title && result.url) {
                    // Log each resource being added with its content length to diagnose issues
                    console.log(`Adding resource to subtopic ${subTopicName}:`, {
                      title: result.title,
                      hasContent: !!result.content,
                      contentLength: result.content?.length || 0
                    });
                    
                    subtopicUpdate.content.resources.push({
                      title: result.title,
                      url: result.url,
                      type: 'link',
                      content: result.content || ''
                    });
                  }
                }
                
                // Add a summary of research results to the main text
                if (subtopicUpdate.content.mainText) {
                  subtopicUpdate.content.mainText += '\n\n## Research Results\n';
                  subtopicResults.forEach(result => {
                    if (result.title) {
                      subtopicUpdate.content.mainText += `\n### ${result.title}\n`;
                      if (result.content) {
                        // Add a preview of the content (first 100 characters)
                        const contentPreview = result.content.substring(0, 100) + 
                          (result.content.length > 100 ? '...' : '');
                        subtopicUpdate.content.mainText += contentPreview + '\n';
                      }
                      if (result.url) {
                        subtopicUpdate.content.mainText += `[Source](${result.url})\n`;
                      }
                    }
                  });
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