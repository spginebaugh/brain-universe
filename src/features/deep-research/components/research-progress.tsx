"use client";

import React, { useState } from 'react';
import { useResearch } from '../hooks/use-research';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

export function ResearchProgress() {
  const [query, setQuery] = useState('');
  const { isLoading, error, sections, startResearch } = useResearch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    await startResearch({
      query: query.trim(),
      numberOfMainSections: 6
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Deep Research</h2>
        <p className="text-gray-600 mb-6">Enter a topic or question to start comprehensive research.</p>
        
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

      <ScrollArea className="h-[600px] rounded-md border">
        {sections.map((section, index) => (
          <Card key={index} className="m-4 p-6">
            <h3 className="text-xl font-semibold mb-3">{section.title}</h3>
            <p className="text-gray-600 mb-4">{section.description}</p>
            
            {section.subsectionTitles && (
              <div className="mb-6">
                <h4 className="font-medium mb-2">Subsections:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {section.subsectionTitles.map((title, idx) => (
                    <li key={idx} className="text-gray-600">{title}</li>
                  ))}
                </ul>
              </div>
            )}

            {section.content && (
              <div className="mt-4">
                {typeof section.content === 'string' ? (
                  <p className="whitespace-pre-wrap text-gray-700">{section.content}</p>
                ) : (
                  <div className="space-y-6">
                    <p className="text-gray-700">{section.content.overview}</p>
                    {Object.entries(section.content.subsections).map(([key, subsection]) => (
                      <div key={key} className="space-y-3">
                        <h4 className="text-lg font-medium">{subsection.title}</h4>
                        <p className="text-gray-700">{subsection.content}</p>
                        {subsection.sources.length > 0 && (
                          <div className="text-sm text-gray-500 mt-2">
                            <p className="font-medium mb-1">Sources:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {subsection.sources.map((source, idx) => (
                                <li key={idx}>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {source.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {isLoading && sections.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
} 