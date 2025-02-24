"use client";

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { RESEARCH_PHASES } from '../types/research';
import type { Chapter, SubTopic, ResearchPhase } from '../types/research';
import type { ChapterContent } from '../types/research';

interface SearchResult {
  title: string;
  content: string;
  url: string;
}

// Helper component for sources
export const SourcesList: React.FC<{ sources: Array<{ title: string; url: string }> }> = ({ sources }) => (
  <div className="text-sm text-gray-500 mt-2 border-l-2 border-gray-200 pl-4">
    <p className="font-medium mb-2">Sources:</p>
    <ul className="space-y-1">
      {sources.map((source, idx: number) => (
        <li key={idx} className="flex items-start">
          <span className="mr-2">•</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline truncate"
            title={source.title}
          >
            {source.title}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

// SubTopic content component
export const SubTopicContent: React.FC<{ subTopic: SubTopic }> = ({ subTopic }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-2">{subTopic.title}</h3>
    <p className="text-gray-700 mb-4">{subTopic.description}</p>
    <div className="prose max-w-none">
      {subTopic.content}
    </div>
    {subTopic.sources && subTopic.sources.length > 0 && (
      <SourcesList sources={subTopic.sources} />
    )}
  </div>
);

// Chapter content display component
export const ChapterContentDisplay: React.FC<{ content: string | ChapterContent }> = ({ content }) => {
  // If content is a string, display it directly
  if (typeof content === 'string') {
    // Try to parse JSON if it's a string that looks like JSON
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const parsedContent = JSON.parse(content) as ChapterContent;
        console.log('Successfully parsed JSON string to ChapterContent', parsedContent);
        
        // If successfully parsed, use the parsed content
        return (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Overview</h3>
              <p className="text-gray-700">{parsedContent.overview}</p>
            </div>
            {parsedContent.subTopics && Object.entries(parsedContent.subTopics).map(([title, subTopicData]) => {
              const subTopic = subTopicData as SubTopic;
              return <SubTopicContent key={title} subTopic={subTopic} />;
            })}
          </div>
        );
      } catch (e) {
        console.error('Failed to parse content string as JSON:', e);
        // Fall back to displaying as string if parsing fails
      }
    }
    
    return (
      <div>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    );
  }

  // For debugging - log the content structure
  console.log('ChapterContent object received:', content);
  
  // Verify content structure before rendering
  if (!content || typeof content !== 'object') {
    console.error('Invalid content object:', content);
    return <div className="text-red-500">Error: Invalid content structure</div>;
  }

  if (!content.overview) {
    console.warn('Missing overview in content:', content);
  }

  if (!content.subTopics) {
    console.warn('Missing subTopics in content:', content);
    return (
      <div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Overview</h3>
          <p className="text-gray-700">{content.overview || 'No overview available'}</p>
        </div>
        <div className="text-amber-500">No sub-topics found in the content</div>
      </div>
    );
  }

  // If content is a ChapterContent object with valid structure
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Overview</h3>
        <p className="text-gray-700">{content.overview}</p>
      </div>
      {content.subTopics && Object.entries(content.subTopics).map(([title, subTopicData]) => {
        const subTopic = subTopicData as SubTopic;
        return <SubTopicContent key={title} subTopic={subTopic} />;
      })}
    </div>
  );
};

// Modified ResearchChapter component to better handle all research phases
export const ResearchChapter: React.FC<{ 
  chapter: Chapter;
}> = ({ 
  chapter
}) => {
  const getStatusBadgeVariant = (status: Chapter['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'researching':
      case 'writing':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: Chapter['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'researching':
        return 'Researching';
      case 'writing':
        return 'Writing';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  // Special handling for different phases
  const isInitialResearchPhase = chapter.phase === RESEARCH_PHASES.INITIAL_RESEARCH;
  const isPlanningPhase = chapter.phase === RESEARCH_PHASES.PLANNING;
  const isChapterResearchPhase = chapter.phase === RESEARCH_PHASES.CHAPTER_RESEARCH;

  let initialResearchContent = null;
  let researchContent = null;

  try {
    if (isInitialResearchPhase && typeof chapter.content === 'string') {
      initialResearchContent = JSON.parse(chapter.content);
    }
    if (isChapterResearchPhase && typeof chapter.content === 'string') {
      researchContent = JSON.parse(chapter.content);
    }
  } catch (e) {
    console.warn('Failed to parse chapter content:', e);
  }

  // Phase-specific rendering
  if (isInitialResearchPhase) {
    return (
      <Card className="mb-4 overflow-hidden">
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Initial Research</h3>
            <Badge variant={getStatusBadgeVariant(chapter.status)}>
              {getStatusText(chapter.status)}
            </Badge>
          </div>
          <div className="text-sm text-gray-600 mb-4">
            {initialResearchContent && initialResearchContent.queries ? (
              <div>
                <p className="font-medium mb-2">Search Queries:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {initialResearchContent.queries.map((query: string, idx: number) => (
                    <li key={idx}>{query}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Gathering initial research data...</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{chapter.title}</h3>
          <Badge variant={getStatusBadgeVariant(chapter.status)}>
            {getStatusText(chapter.status)}
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mb-4">{chapter.description}</p>
        
        {isPlanningPhase && (
          <div>
            <h4 className="text-md font-medium mb-2">SubTopics:</h4>
            <ul className="list-disc pl-5 space-y-1">
              {chapter.subTopicNames.map((title, idx) => (
                <li key={idx} className="text-sm">{title}</li>
              ))}
            </ul>
          </div>
        )}
        
        {isChapterResearchPhase && researchContent && (
          <div>
            <h4 className="text-md font-medium mb-2">Research Data:</h4>
            {researchContent.searchResults && (
              <div className="text-sm">
                <p className="font-medium">Sources: {researchContent.searchResults.length}</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  {researchContent.searchResults.slice(0, 3).map((result: SearchResult, idx: number) => (
                    <li key={idx}>
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {result.title}
                      </a>
                    </li>
                  ))}
                  {researchContent.searchResults.length > 3 && (
                    <li className="text-gray-500">
                      +{researchContent.searchResults.length - 3} more sources
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {chapter.content && !isInitialResearchPhase && !isPlanningPhase && !isChapterResearchPhase && (
          <div className="mt-4 border-t pt-4">
            <div className="text-sm text-gray-500 mb-2">
              {chapter.phase && `Phase: ${chapter.phase}`} | {chapter.status && `Status: ${chapter.status}`}
              {chapter.timestamp && ` | Last updated: ${new Date(chapter.timestamp).toLocaleString()}`}
            </div>
            <ChapterContentDisplay content={chapter.content} />
          </div>
        )}
      </div>
    </Card>
  );
};

// Modified PhaseHeader to show more detailed information
export const PhaseHeader: React.FC<{ 
  phase: ResearchPhase;
  chapters: Chapter[];
}> = ({ 
  phase,
  chapters
}) => {
  const getPhaseColor = () => {
    switch (phase) {
      case RESEARCH_PHASES.INITIAL_RESEARCH:
        return 'bg-amber-100 text-amber-800';
      case RESEARCH_PHASES.PLANNING:
        return 'bg-blue-100 text-blue-800';
      case RESEARCH_PHASES.CHAPTER_RESEARCH:
        return 'bg-purple-100 text-purple-800';
      case RESEARCH_PHASES.CHAPTER_WRITING:
        return 'bg-green-100 text-green-800';
      case RESEARCH_PHASES.COMPLETE:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPhaseProgress = () => {
    if (phase === RESEARCH_PHASES.INITIAL_RESEARCH) {
      return 'Initial research';
    }
    
    if (phase === RESEARCH_PHASES.PLANNING) {
      return `${chapters.length} chapters planned`;
    }
    
    if (phase === RESEARCH_PHASES.CHAPTER_RESEARCH) {
      const researching = chapters.filter(c => c.status === 'researching').length;
      return `${researching}/${chapters.length} chapters researching`;
    }
    
    if (phase === RESEARCH_PHASES.CHAPTER_WRITING) {
      const writing = chapters.filter(c => c.status === 'writing').length;
      return `${writing}/${chapters.length} chapters writing`;
    }
    
    if (phase === RESEARCH_PHASES.COMPLETE) {
      const completed = chapters.filter(c => c.status === 'completed').length;
      return `${completed}/${chapters.length} chapters completed`;
    }
    
    return `${chapters.length} chapters`;
  };

  return (
    <div className={`p-4 rounded-t-lg ${getPhaseColor()}`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">{phase} Phase</h2>
          <p className="text-sm opacity-75">
            {phase === RESEARCH_PHASES.INITIAL_RESEARCH && 'Initial research to understand the topic'}
            {phase === RESEARCH_PHASES.PLANNING && 'Planning and outlining the research structure'}
            {phase === RESEARCH_PHASES.CHAPTER_RESEARCH && 'Gathering information from various sources'}
            {phase === RESEARCH_PHASES.CHAPTER_WRITING && 'Writing and organizing content'}
            {phase === RESEARCH_PHASES.COMPLETE && 'Final research output'}
          </p>
        </div>
        <Badge variant="outline" className="ml-2">
          {getPhaseProgress()}
        </Badge>
      </div>
    </div>
  );
};

// Loading indicator component
export const LoadingIndicator: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-32 space-y-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    <p className="text-gray-600">Generating research outline...</p>
  </div>
);

// Empty state component
export const EmptyState: React.FC = () => (
  <div className="flex items-center justify-center h-32 text-gray-500">
    Enter a topic above to start research
  </div>
);

// Error display component
export const ErrorDisplay: React.FC<{ error: string | null; sessionId?: string }> = ({ error, sessionId }) => (
  <div className="mt-4 text-red-500 p-4 rounded bg-red-50 border border-red-200">
    <h3 className="font-semibold mb-1">Error</h3>
    <p>{error}</p>
    <p className="text-sm mt-2">
      Session ID: {sessionId || 'None'}
    </p>
  </div>
);

// Loading state component
export const LoadingState: React.FC = () => (
  <div className="mt-4 text-blue-500 p-4 rounded bg-blue-50 border border-blue-200">
    <div className="flex items-center">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
      <span>Research in progress...</span>
    </div>
  </div>
);

// Research form component
export interface ResearchFormProps {
  query: string;
  setQuery: (query: string) => void;
  numberOfChapters: number;
  setNumberOfChapters: (num: number) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const ResearchForm: React.FC<ResearchFormProps> = ({
  query,
  setQuery,
  numberOfChapters,
  setNumberOfChapters,
  isLoading,
  onSubmit
}) => (
  <Card className="p-6">
    <h2 className="text-2xl font-semibold mb-4">Deep Research</h2>
    <p className="text-gray-600 mb-6">
      Enter a topic or question to start comprehensive research.
    </p>
    
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
            Research Subject
          </label>
          <Input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a topic to research..."
            disabled={isLoading}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label htmlFor="chapters" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Chapters
          </label>
          <Input
            id="chapters"
            type="number"
            min={1}
            max={10}
            value={numberOfChapters}
            onChange={(e) => setNumberOfChapters(parseInt(e.target.value))}
            disabled={isLoading}
            className="w-32"
          />
        </div>
      </div>

      <Button onClick={onSubmit} disabled={isLoading} className="w-full">
        {isLoading ? 'Researching...' : 'Start Research'}
      </Button>
    </div>
  </Card>
);

// Research results display component
export interface ResearchResultsProps {
  groupedChapters: Record<ResearchPhase, Chapter[]>;
  isLoading: boolean;
}

export const ResearchResults: React.FC<ResearchResultsProps> = ({
  groupedChapters,
  isLoading
}) => (
  <ScrollArea className="h-[600px] rounded-md border bg-gray-50">
    {Object.entries(groupedChapters).length > 0 ? (
      Object.entries(groupedChapters).map(([phase, chapters]) => (
        <div key={phase} className="mb-8">
          <PhaseHeader 
            phase={phase as ResearchPhase} 
            chapters={chapters}
          />
          <div className="bg-white rounded-b-lg">
            {chapters.map((chapter, index) => (
              <ResearchChapter 
                key={`${phase}-${index}`}
                chapter={chapter}
              />
            ))}
          </div>
        </div>
      ))
    ) : isLoading ? (
      <LoadingIndicator />
    ) : (
      <EmptyState />
    )}
  </ScrollArea>
); 