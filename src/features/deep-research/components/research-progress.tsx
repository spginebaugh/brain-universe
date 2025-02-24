"use client";

import React, { useState } from 'react';
import { useResearch } from '../hooks/use-research';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { RESEARCH_STEPS } from '../types/research';
import type { Section, SubSection, ResearchStep, ResearchStepInfo } from '../types/research';
import type { SectionContent } from '../types/research';

interface SearchResult {
  title: string;
  content: string;
  url: string;
}

// Helper component for sources
const SourcesList: React.FC<{ sources: Array<{ title: string; url: string }> }> = ({ sources }) => (
  <div className="text-sm text-gray-500 mt-2 border-l-2 border-gray-200 pl-4">
    <p className="font-medium mb-2">Sources:</p>
    <ul className="space-y-1">
      {sources.map((source, idx) => (
        <li key={idx} className="flex items-start">
          <span className="mr-2">•</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline hover:text-blue-600 transition-colors"
          >
            {source.title}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

// Helper component for subsections
const SubsectionContent: React.FC<{ subsection: SubSection }> = ({ subsection }) => (
  <div className="space-y-3 border rounded-lg p-4 bg-white/50">
    <h4 className="text-lg font-medium text-gray-900">{subsection.title}</h4>
    <p className="text-gray-600 text-sm italic">{subsection.description}</p>
    <div className="prose prose-sm max-w-none">
      <p className="text-gray-700 whitespace-pre-wrap">{subsection.content}</p>
    </div>
    {subsection.sources?.length > 0 && <SourcesList sources={subsection.sources} />}
  </div>
);

// Helper component for section content
const SectionContent: React.FC<{ content: string | SectionContent }> = ({ content }) => {
  if (typeof content === 'string') {
    return <p className="whitespace-pre-wrap text-gray-700">{content}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 border">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Overview</h4>
        <p className="text-gray-700">{content.overview}</p>
      </div>
      <div className="space-y-4">
        {Object.entries(content.subsections).map(([key, subsection]) => (
          <SubsectionContent key={key} subsection={subsection} />
        ))}
      </div>
    </div>
  );
};

// Modified ResearchSection component to better handle all research steps
const ResearchSection: React.FC<{ 
  section: Section;
}> = ({ 
  section
}) => {
  const getStatusBadgeVariant = (status: Section['status']) => {
    switch (status) {
      case 'done':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: Section['status']) => {
    switch (status) {
      case 'done':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  // Special handling for different phases
  const isQueryResearchPhase = section.step === RESEARCH_STEPS.QUERY_RESEARCH;
  const isPlanningPhase = section.step === RESEARCH_STEPS.PLANNING;
  const isResearchPhase = section.step === RESEARCH_STEPS.RESEARCH;

  let queryResearchContent = null;
  let planningContent = null;
  let researchContent = null;

  try {
    if (isQueryResearchPhase && typeof section.content === 'string') {
      queryResearchContent = JSON.parse(section.content);
    }
    if (isPlanningPhase && typeof section.content === 'string') {
      planningContent = JSON.parse(section.content);
    }
    if (isResearchPhase && typeof section.content === 'string') {
      researchContent = JSON.parse(section.content);
    }
  } catch (e) {
    console.warn('Failed to parse section content:', e);
  }

  return (
    <Card className="m-4 p-6 relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
            <Badge 
              variant={getStatusBadgeVariant(section.status)} 
              className="ml-2"
            >
              {getStatusText(section.status)}
            </Badge>
          </div>
          <p className="text-gray-600 mt-1">{section.description}</p>
          {section.timestamp && (
            <p className="text-xs text-gray-500 mt-1">
              {new Date(section.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Display query research phase content */}
      {isQueryResearchPhase && queryResearchContent && (
        <div className="mt-4 space-y-4">
          {queryResearchContent.queries && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">Initial Search Queries</h4>
              <ul className="list-disc list-inside space-y-1">
                {Array.isArray(queryResearchContent.queries) ? 
                  queryResearchContent.queries.map((query: string, idx: number) => (
                    <li key={idx} className="text-amber-800">{query}</li>
                  )) : 
                  <li className="text-amber-800">{String(queryResearchContent.queries)}</li>
                }
              </ul>
            </div>
          )}
          {queryResearchContent.results && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">Initial Research Results</h4>
              <div className="space-y-4">
                {queryResearchContent.results.map((result: SearchResult, idx: number) => (
                  <div key={idx} className="border-l-2 border-amber-200 pl-4">
                    <h5 className="font-medium text-amber-900">{result.title}</h5>
                    <p className="text-amber-800 text-sm mt-1">{result.content}</p>
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-amber-600 text-xs hover:underline mt-1 block"
                    >
                      Source
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Display planning phase content */}
      {isPlanningPhase && planningContent && (
        <div className="mt-4 space-y-4">
          {planningContent.outline && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Research Outline</h4>
              <pre className="whitespace-pre-wrap text-sm text-blue-800">
                {typeof planningContent.outline === 'string' 
                  ? planningContent.outline 
                  : JSON.stringify(planningContent.outline, null, 2)}
              </pre>
            </div>
          )}
          {planningContent.approach && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">Research Approach</h4>
              <p className="text-purple-800">{planningContent.approach}</p>
            </div>
          )}
        </div>
      )}

      {/* Display research phase content */}
      {isResearchPhase && researchContent && (
        <div className="mt-4 space-y-4">
          {researchContent.queries && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">Search Queries</h4>
              <ul className="list-disc list-inside space-y-1">
                {Array.isArray(researchContent.queries) ? 
                  researchContent.queries.map((query: string, idx: number) => (
                    <li key={idx} className="text-amber-800">{query}</li>
                  )) : 
                  <li className="text-amber-800">{String(researchContent.queries)}</li>
                }
              </ul>
            </div>
          )}
          {researchContent.sourceData && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Research Data</h4>
              <div className="prose prose-sm max-w-none text-green-800">
                <p className="whitespace-pre-wrap">{researchContent.sourceData}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Display section content for writing phase */}
      {section.subsectionTitles && (
        <div className="mb-6">
          <h4 className="font-medium mb-2 text-gray-700">Planned Subsections:</h4>
          <div className="flex flex-wrap gap-2">
            {section.subsectionTitles.map((title, idx) => (
              <Badge key={idx} variant="outline" className="text-gray-600">
                {title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Display final content */}
      {section.content && !isPlanningPhase && !isResearchPhase && (
        <div className="mt-6">
          <SectionContent content={section.content} />
        </div>
      )}
    </Card>
  );
};

// Modified StepHeader to show more detailed information
const StepHeader: React.FC<{ 
  step: ResearchStep;
  sections: Section[];
}> = ({ 
  step,
  sections
}) => {
  const getStepColor = () => {
    switch (step) {
      case RESEARCH_STEPS.QUERY_RESEARCH:
        return 'bg-amber-100 text-amber-800';
      case RESEARCH_STEPS.PLANNING:
        return 'bg-blue-100 text-blue-800';
      case RESEARCH_STEPS.RESEARCH:
        return 'bg-purple-100 text-purple-800';
      case RESEARCH_STEPS.WRITING:
        return 'bg-green-100 text-green-800';
      case RESEARCH_STEPS.COMPLETE:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepProgress = () => {
    const completedInStep = sections.filter(s => s.status === 'done').length;
    return `${completedInStep}/${sections.length} sections`;
  };

  return (
    <div className={`p-4 rounded-t-lg ${getStepColor()}`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">{step} Phase</h2>
          <p className="text-sm opacity-75">
            {step === RESEARCH_STEPS.QUERY_RESEARCH && 'Initial research to understand the topic'}
            {step === RESEARCH_STEPS.PLANNING && 'Planning and outlining the research structure'}
            {step === RESEARCH_STEPS.RESEARCH && 'Gathering information from various sources'}
            {step === RESEARCH_STEPS.WRITING && 'Writing and organizing content'}
            {step === RESEARCH_STEPS.COMPLETE && 'Final research output'}
          </p>
        </div>
        <Badge variant="outline" className="ml-2">
          {getStepProgress()}
        </Badge>
      </div>
    </div>
  );
};

export function ResearchProgress() {
  const [query, setQuery] = useState('');
  const [numberOfSections, setNumberOfSections] = useState(6);
  const { isLoading, error, currentSessionId, getSession, startResearch } = useResearch();
  
  // Get completedSections directly from the session state
  const session = currentSessionId ? getSession(currentSessionId) : undefined;
  console.log('Current session in component:', session); // Debug log
  
  const completedSections = session?.state.completedSections || [];
  console.log('Completed sections:', completedSections); // Debug log

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    console.log('Starting research with query:', query); // Debug log
    await startResearch({
      query: query.trim(),
      numberOfMainSections: numberOfSections
    });
  };

  // Log render state
  console.log('Render state:', { isLoading, error, currentSessionId, completedSectionsLength: completedSections.length });

  // Group sections by step
  const groupedSections = completedSections.reduce((acc, section) => {
    const step = section.step || RESEARCH_STEPS.RESEARCH;
    if (!acc[step]) {
      acc[step] = [];
    }
    acc[step].push(section);
    return acc;
  }, {} as Record<ResearchStep, Section[]>);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Deep Research</h2>
        <p className="text-gray-600 mb-6">
          Enter a topic or question to start comprehensive research.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="sections" className="block text-sm font-medium text-gray-700 mb-1">
                Number of Main Sections
              </label>
              <Input
                id="sections"
                type="number"
                min={1}
                max={10}
                value={numberOfSections}
                onChange={(e) => setNumberOfSections(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                disabled={isLoading}
                className="w-32"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., 'What are the implications of quantum computing on cryptography?'"
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? 'Researching...' : 'Start Research'}
              </Button>
            </form>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-red-500 p-2 rounded bg-red-50">
            {error}
          </div>
        )}
      </Card>

      <ScrollArea className="h-[600px] rounded-md border bg-gray-50">
        {Object.entries(groupedSections).length > 0 ? (
          Object.entries(groupedSections).map(([step, sections]) => (
            <div key={step} className="mb-8">
              <StepHeader 
                step={step as ResearchStep} 
                sections={sections}
              />
              <div className="bg-white rounded-b-lg">
                {sections.map((section, index) => (
                  <ResearchSection 
                    key={`${step}-${index}`}
                    section={section}
                  />
                ))}
              </div>
            </div>
          ))
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            <p className="text-gray-600">Generating research outline...</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500">
            Enter a topic above to start research
          </div>
        )}
      </ScrollArea>
    </div>
  );
} 