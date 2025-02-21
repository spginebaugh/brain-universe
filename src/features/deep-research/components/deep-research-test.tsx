'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { useDeepResearch } from '../hooks/use-deep-research';
import { ResearchStep, ResearchSource } from '../types/deep-research-types';

export const DeepResearchTest = () => {
  const [query, setQuery] = useState('');
  const { 
    isLoading, 
    error, 
    result, 
    requiresFeedback,
    feedbackPrompt,
    performResearch,
    provideFeedback 
  } = useDeepResearch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performResearch({ query });
  };

  const handleFeedback = async (feedback: boolean) => {
    await provideFeedback(feedback);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Deep Research Test</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your research query..."
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Researching...' : 'Research'}
          </Button>
        </div>
      </form>

      {error && (
        <Card className="p-4 bg-red-50 text-red-700">
          {error}
        </Card>
      )}

      {requiresFeedback && feedbackPrompt && (
        <Card className="p-4 bg-blue-50">
          <h3 className="font-medium mb-2">Feedback Required:</h3>
          <p className="whitespace-pre-wrap mb-4">{feedbackPrompt}</p>
          <div className="flex gap-2">
            <Button onClick={() => handleFeedback(true)} variant="outline">
              Approve
            </Button>
            <Button onClick={() => handleFeedback(false)} variant="outline">
              Reject
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          <div className="space-y-4">
            {result.finalAnswer && (
              <div>
                <h3 className="font-medium mb-2">Final Answer:</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{result.finalAnswer}</p>
              </div>
            )}

            {result.steps && result.steps.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Research Steps:</h3>
                <ScrollArea className="h-[300px]">
                  {result.steps.map((step: ResearchStep, index: number) => (
                    <div key={index} className="mb-4 p-3 bg-gray-50 rounded">
                      <p className="font-medium text-sm text-gray-600">{step.agentName}</p>
                      <p className="mt-1 whitespace-pre-wrap">{step.thought}</p>
                      {step.action && (
                        <p className="mt-1 text-sm text-blue-600">Action: {step.action}</p>
                      )}
                      {step.observation && (
                        <p className="mt-1 text-sm text-green-600 whitespace-pre-wrap">
                          Observation: {step.observation}
                        </p>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {result.sources && result.sources.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Sources:</h3>
                <ScrollArea className="h-[200px]">
                  {result.sources.map((source: ResearchSource, index: number) => (
                    <div key={index} className="mb-4 p-3 bg-gray-50 rounded">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source.title}
                      </a>
                      <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{source.content}</p>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}; 