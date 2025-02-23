"use client";

import React, { useState } from 'react';
import { useResearch } from '../hooks/use-research';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import type { Section, SubSection } from '../types/research';
import type { SectionContent } from '../types/research';

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
    {subsection.sources.length > 0 && <SourcesList sources={subsection.sources} />}
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

// Helper component for section
const ResearchSection: React.FC<{ section: Section; isCompleted: boolean }> = ({ section, isCompleted }) => (
  <Card className="m-4 p-6 relative">
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
        <p className="text-gray-600 mt-1">{section.description}</p>
      </div>
      <Badge variant={isCompleted ? "default" : "secondary"} className="ml-2">
        {isCompleted ? "Completed" : "In Progress"}
      </Badge>
    </div>

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

    {section.content && (
      <div className="mt-6">
        <SectionContent content={section.content} />
      </div>
    )}
  </Card>
);

export function ResearchProgress() {
  const [query, setQuery] = useState('');
  const { isLoading, error, sections, currentSessionId, getSession, startResearch } = useResearch();
  
  const currentSession = currentSessionId ? getSession(currentSessionId) : undefined;
  const completedSections = currentSession?.state.completedSections || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    await startResearch({
      query: query.trim(),
      numberOfMainSections: 6
    });
  };

  const allSections = [...sections, ...completedSections];
  const isCompleted = (section: Section) => 
    completedSections.some((completed: Section) => completed.title === section.title);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Deep Research</h2>
        <p className="text-gray-600 mb-6">
          Enter a topic or question to start comprehensive research.
        </p>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
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

        {error && (
          <div className="mt-4 text-red-500 p-2 rounded bg-red-50">
            {error}
          </div>
        )}
      </Card>

      <ScrollArea className="h-[600px] rounded-md border bg-gray-50">
        {allSections.length > 0 ? (
          allSections.map((section, index) => (
            <ResearchSection 
              key={index} 
              section={section} 
              isCompleted={isCompleted(section)} 
            />
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