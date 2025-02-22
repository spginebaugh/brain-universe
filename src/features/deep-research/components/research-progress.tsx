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
    <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your research topic..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !query.trim()}>
          {isLoading ? 'Researching...' : 'Start Research'}
        </Button>
      </form>

      {error && (
        <div className="text-red-500 p-2 rounded bg-red-50">
          {error}
        </div>
      )}

      <ScrollArea className="h-[600px] rounded-md border p-4">
        {sections.map((section, index) => (
          <Card key={index} className="mb-4 p-4">
            <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
            <p className="text-gray-600 mb-2">{section.description}</p>
            
            {section.subsectionTitles && (
              <div className="mb-4">
                <h4 className="font-medium mb-1">Subsections:</h4>
                <ul className="list-disc list-inside">
                  {section.subsectionTitles.map((title, idx) => (
                    <li key={idx} className="text-gray-600">{title}</li>
                  ))}
                </ul>
              </div>
            )}

            {section.content && (
              <div className="mt-4">
                {typeof section.content === 'string' ? (
                  <p className="whitespace-pre-wrap">{section.content}</p>
                ) : (
                  <div>
                    <p className="mb-4">{section.content.overview}</p>
                    {Object.entries(section.content.subsections).map(([key, subsection]) => (
                      <div key={key} className="mb-4">
                        <h4 className="font-medium">{subsection.title}</h4>
                        <p className="mb-2">{subsection.content}</p>
                        {subsection.sources.length > 0 && (
                          <div className="text-sm text-gray-500">
                            Sources:
                            <ul className="list-disc list-inside">
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