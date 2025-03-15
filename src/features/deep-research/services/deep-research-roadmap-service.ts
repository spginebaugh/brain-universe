import { 
  ResearchService, 
  ResearchSessionData, 
  ResearchRequest 
} from './research-service';
import { GraphService } from '@/shared/services/firebase/graph-service';
import {
  generatePlaceholderNodesFromChapters,
  generateSubtopicNodesForChapter,
  updateCompletedChapter,
  NodeGenerationOptions
} from '../utils/node-generation-utils';
import { NodeStatus } from '@/shared/types/node';

export interface RoadmapGenerationInput {
  rootNodeId: string;
  rootNodePosition: { x: number; y: number };
  rootNodeTitle: string;
  graphId: string;
  graphName: string;
  graphPosition: { x: number; y: number };
  numberOfChapters: number;
}

export interface RoadmapGenerationProgress {
  progress: number;
  phase: string;
  isComplete: boolean;
  error?: string;
}

export type RoadmapProgressCallback = (progress: RoadmapGenerationProgress) => void;

export class DeepResearchRoadmapService {
  private researchService: ResearchService;
  private graphService: GraphService;
  private abortController: AbortController | null = null;
  private generatedNodeIds: Record<string, string> = {};
  private generatedSubtopicIds: Record<string, Record<string, string>> = {};
  private sessionId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  
  constructor(private userId: string) {
    this.researchService = new ResearchService();
    this.graphService = new GraphService(userId);
  }
  
  /**
   * Utility function to sanitize data before sending to Firestore
   * Removes any properties with undefined values that would cause Firebase to reject the update
   */
  private sanitizeFirestoreData<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = { ...obj } as Record<string, unknown>;
    
    Object.keys(result).forEach(key => {
      const value = result[key];
      
      if (value === undefined) {
        delete result[key];
      } 
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeFirestoreData(value as Record<string, unknown>);
        
        if (Object.keys(result[key] as object).length === 0) {
          result[key] = {};
        }
      }
      else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeFirestoreData(item) : item
        ).filter(item => item !== undefined);
      }
    });
    
    return result as unknown as T;
  }
  
  /**
   * Start the deep research process
   */
  async startResearch(
    input: RoadmapGenerationInput,
    onProgress: RoadmapProgressCallback
  ): Promise<string> {
    try {
      // Report initial progress
      onProgress({
        progress: 0,
        phase: 'Starting research...',
        isComplete: false
      });
      
      // Create the research request
      const request: ResearchRequest = {
        query: input.rootNodeTitle,
        numberOfChapters: input.numberOfChapters
      };
      
      // Start the research - this will create a document in Firestore and trigger the cloud function
      console.log('Starting research for:', input.rootNodeTitle);
      
      try {
        this.sessionId = await this.researchService.startResearch(request);
        console.log('Research session created:', this.sessionId);
        
        // Even if we get a timeout from the cloud function, we can still track progress via Firestore
        onProgress({
          progress: 5,
          phase: 'Research initiated. This may take up to 60 minutes.',
          isComplete: false
        });
        
        // Set up progress tracking
        this.setupProgressTracking(input, onProgress);
        
        return this.sessionId;
      } catch (error) {
        // If we got an error but have a session ID, we might be able to continue
        // This handles the case where the function call times out but continues processing
        if (this.sessionId) {
          console.log('Continuing with session ID despite error:', this.sessionId, error);
          
          onProgress({
            progress: 5,
            phase: 'Research initiated despite timeout. Tracking progress...',
            isComplete: false
          });
          
          // Set up progress tracking anyway
          this.setupProgressTracking(input, onProgress);
          
          return this.sessionId;
        }
        
        // Otherwise, re-throw the error
        throw error;
      }
    } catch (error) {
      console.error('Failed to start research:', error);
      onProgress({
        progress: 0,
        phase: 'Error',
        isComplete: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Set up Firestore listener to track research progress
   */
  private setupProgressTracking(
    input: RoadmapGenerationInput,
    onProgress: RoadmapProgressCallback
  ): void {
    if (!this.sessionId) {
      console.error('No session ID available for progress tracking');
      return;
    }

    // Create abort controller
    this.abortController = new AbortController();
    
    // Provide better initial feedback about the long-running process
    onProgress({
      progress: 5,
      phase: 'Research process started. This can take 30-60 minutes.',
      isComplete: false
    });
    
    // Set up listener for Firestore updates
    this.unsubscribe = this.researchService.trackResearchProgress(
      this.sessionId,
      async (data) => {
        // Check if we've been cancelled
        if (this.abortController?.signal.aborted) {
          console.log('Research was cancelled');
          return;
        }
        
        // Debug log to see what data we're getting
        console.log('Research progress data:', {
          status: data.status,
          phase: data.currentPhase,
          chapters: data.chapters?.length || 0
        });
        
        // Calculate progress percentage - this will be 0-70%
        // We reserve 70-100% for the graph generation
        let progress = this.researchService.calculateProgressPercentage(data);
        
        // Cap progress at 70% until we start graph generation
        progress = Math.min(progress, 70);
        
        // Get phase label
        const phase = data.currentPhase 
          ? this.researchService.getPhaseLabel(data)
          : 'Setting up research process...';
        
        // Report progress
        onProgress({
          progress,
          phase,
          isComplete: data.status === 'completed'
        });
        
        // If research is complete, generate the graph
        if (data.status === 'completed') {
          try {
            // First update to show we're starting graph generation
            onProgress({
              progress: 70,
              phase: 'Research complete! Generating graph...',
              isComplete: false
            });
            
            // Generate the graph from research data
            await this.generateGraph(data, input, (graphProgress) => {
              // Forward graph generation progress, but scale it from 70-100%
              onProgress({
                progress: 70 + (graphProgress.progress * 0.3),
                phase: graphProgress.phase,
                isComplete: graphProgress.isComplete,
                error: graphProgress.error
              });
            });
          } catch (error) {
            console.error('Error generating graph:', error);
            onProgress({
              progress: 100,
              phase: 'Error generating graph',
              isComplete: true,
              error: error instanceof Error ? error.message : 'Unknown error generating graph'
            });
          }
        }
        // If there's an error, report it
        else if (data.status === 'error') {
          onProgress({
            progress: 100,
            phase: 'Research failed',
            isComplete: true,
            error: data.error || 'Unknown error occurred during research'
          });
        }
      },
      (error) => {
        console.error('Error tracking research progress:', error);
        onProgress({
          progress: 0,
          phase: 'Error tracking progress',
          isComplete: true,
          error: error.message
        });
      }
    );
    
    // Set a timeout to provide status updates even if Firestore doesn't update
    let updateCount = 0;
    const maxUpdates = 12; // Give status messages for up to an hour
    
    const statusUpdateInterval = setInterval(() => {
      updateCount++;
      
      // Check if we need to stop
      if (this.abortController?.signal.aborted || !this.unsubscribe || updateCount >= maxUpdates) {
        clearInterval(statusUpdateInterval);
        return;
      }
      
      // Calculate a pseudo-progress based on time passed
      // This gives the user some feedback when Firestore isn't updating
      const baseProgress = Math.min(60, updateCount * 5); // Max 60% over an hour
      
      onProgress({
        progress: baseProgress,
        phase: `Research in progress (${updateCount * 5} minutes)...`,
        isComplete: false
      });
      
    }, 5 * 60 * 1000); // Update every 5 minutes
    
    // Store the interval so we can clear it if needed
    const originalUnsubscribe = this.unsubscribe;
    this.unsubscribe = () => {
      clearInterval(statusUpdateInterval);
      originalUnsubscribe();
    };
  }
  
  /**
   * Cancel the current research process
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
  
  /**
   * Generate graph from completed research data
   */
  private async generateGraph(
    researchData: ResearchSessionData,
    input: RoadmapGenerationInput,
    onProgress: RoadmapProgressCallback
  ): Promise<void> {
    onProgress({
      progress: 0,
      phase: 'Creating graph from research...',
      isComplete: false
    });
    
    // Reset tracking objects
    this.generatedNodeIds = {};
    this.generatedSubtopicIds = {};
    
    try {
      if (!researchData || !researchData.chapters || researchData.chapters.length === 0) {
        throw new Error('No research data available to generate graph');
      }
      
      const chapters = researchData.chapters;
      const options: NodeGenerationOptions = {
        parentNodeId: input.rootNodeId,
        parentNodePosition: input.rootNodePosition,
        graphId: input.graphId,
        graphName: input.graphName,
        graphPosition: input.graphPosition
      };
      
      // 1. First create all chapter nodes
      onProgress({ progress: 10, phase: 'Creating chapter nodes...', isComplete: false });
      const { reactFlowNodes, dbNodes, dbEdges } = 
        generatePlaceholderNodesFromChapters(chapters, options);
      
      // Store node IDs for later reference
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const nodeId = reactFlowNodes[i].id;
        this.generatedNodeIds[chapter.title] = nodeId;
        console.log(`Generated node ID for chapter "${chapter.title}": ${nodeId}`);
      }
      
      // 2. Save chapter nodes to database
      const chapterNodePromises = [
        ...dbNodes.map(node => this.graphService.createNode(options.graphId, node)),
        ...dbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
      ];
      
      await Promise.all(chapterNodePromises);
      console.log(`Created ${dbNodes.length} chapter nodes and ${dbEdges.length} edges`);
      
      // 3. Update progress
      onProgress({ progress: 30, phase: 'Creating subtopic nodes...', isComplete: false });
      
      // 4. Create all subtopic nodes
      const subtopicPromises: Promise<void>[] = [];
      
      for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
        const chapter = chapters[chapterIndex];
        const chapterNodeId = this.generatedNodeIds[chapter.title];
        
        if (!chapterNodeId) {
          console.warn(`No node ID found for chapter ${chapter.title}`);
          continue;
        }
        
        const chapterPosition = reactFlowNodes[chapterIndex].position;
        
        // Skip if no content or subtopics
        if (!chapter.content?.subTopics) continue;
        
        // Prepare storage for subtopics for this chapter
        if (!this.generatedSubtopicIds[chapter.title]) {
          this.generatedSubtopicIds[chapter.title] = {};
        }
        
        // Generate subtopic nodes
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
        
        // Store subtopic node IDs
        const subTopicNames = Object.keys(chapter.content.subTopics);
        subTopicNames.forEach((subTopicName, i) => {
          if (i < subtopicNodes.length) {
            const subtopicNodeId = subtopicNodes[i].id;
            if (!this.generatedSubtopicIds[chapter.title]) {
              this.generatedSubtopicIds[chapter.title] = {};
            }
            this.generatedSubtopicIds[chapter.title][subTopicName] = subtopicNodeId;
          }
        });
        
        // Save subtopic nodes and edges
        subtopicPromises.push(
          (async () => {
            try {
              await Promise.all([
                ...subtopicDbNodes.map(node => this.graphService.createNode(options.graphId, node)),
                ...subtopicDbEdges.map(edge => this.graphService.createEdge(options.graphId, edge))
              ]);
              console.log(`Created ${subtopicDbNodes.length} subtopic nodes for chapter "${chapter.title}"`);
            } catch (error) {
              console.error(`Error creating subtopic nodes for chapter "${chapter.title}":`, error);
            }
          })()
        );
      }
      
      // Wait for all subtopic nodes to be created
      await Promise.all(subtopicPromises);
      
      // 5. Update progress
      onProgress({ progress: 60, phase: 'Updating chapter content...', isComplete: false });
      
      // 6. Update all chapter nodes with content
      const chapterUpdatePromises = chapters.map(async (chapter) => {
        try {
          const nodeId = this.generatedNodeIds[chapter.title];
          if (!nodeId) {
            console.warn(`No node ID found for chapter ${chapter.title}`);
            return;
          }
          
          const chapterUpdate = updateCompletedChapter(chapter);
          const sanitizedUpdate = this.sanitizeFirestoreData(chapterUpdate);
          
          await this.graphService.updateNode(options.graphId, nodeId, sanitizedUpdate);
        } catch (error) {
          console.error(`Error updating chapter node for ${chapter.title}:`, error);
        }
      });
      
      await Promise.all(chapterUpdatePromises);
      
      // 7. Update progress
      onProgress({ progress: 80, phase: 'Updating subtopic content...', isComplete: false });
      
      // 8. Update all subtopic nodes with content
      const subtopicUpdatePromises: Promise<void>[] = [];
      
      for (const chapter of chapters) {
        if (!chapter.content?.subTopics) continue;
        
        const subTopicNames = Object.keys(chapter.content.subTopics);
        for (const subTopicName of subTopicNames) {
          subtopicUpdatePromises.push(
            (async () => {
              try {
                const subtopicNodeId = this.generatedSubtopicIds[chapter.title]?.[subTopicName];
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
                
                // If no specific subtopic results were found, use untargeted results
                if (subtopicResults.length === 0 && chapter.research?.results) {
                  // Find untargeted results
                  const untargetedResults = chapter.research.results.filter(
                    result => !result.targetSubTopic || result.targetSubTopic === ''
                  );
                  
                  if (untargetedResults.length > 0) {
                    // Use a few untargeted results if there aren't too many
                    if (untargetedResults.length <= 3) {
                      subtopicResults.push(...untargetedResults);
                    } else {
                      // Distribute results across subtopics
                      const subTopicCount = Object.keys(chapter.content!.subTopics).length;
                      const subTopicIndex = Object.keys(chapter.content!.subTopics).indexOf(subTopicName);
                      
                      if (subTopicCount > 0 && subTopicIndex >= 0) {
                        const resultsPerSubtopic = Math.ceil(untargetedResults.length / subTopicCount);
                        const startIndex = subTopicIndex * resultsPerSubtopic;
                        const endIndex = Math.min(startIndex + resultsPerSubtopic, untargetedResults.length);
                        subtopicResults.push(...untargetedResults.slice(startIndex, endIndex));
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
                
                // No research results? Use chapter overview as content
                if (subtopicResults.length === 0 && subtopicUpdate.content.mainText === '' && chapter.content?.overview) {
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
                        content: ''
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
                
                // Sanitize update data to remove any undefined values
                const sanitizedUpdate = this.sanitizeFirestoreData(subtopicUpdate);
                
                // Update the subtopic node
                await this.graphService.updateNode(options.graphId, subtopicNodeId, sanitizedUpdate);
              } catch (error) {
                console.error(`Error updating subtopic node for ${subTopicName}:`, error);
              }
            })()
          );
        }
      }
      
      await Promise.all(subtopicUpdatePromises);
      
      // 9. Final progress update
      onProgress({ progress: 100, phase: 'Graph generation complete', isComplete: true });
      
    } catch (error) {
      console.error('Error generating graph:', error);
      onProgress({
        progress: 100,
        phase: 'Error generating graph',
        isComplete: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 