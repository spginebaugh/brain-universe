'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { useDeepResearch } from '../hooks/use-deep-research';
import { ResearchStep, Section } from '../types/deep-research-types';

const SectionDisplay = ({ section }: { section: Section }) => {
  return (
    <AccordionItem value={section.title} className="border rounded-lg p-2 mb-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-col items-start text-left">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <p className="text-sm text-gray-600">{section.description}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {section.content ? (
          <div className="space-y-4 pt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Overview</h4>
              <p className="text-gray-700">{section.content.overview}</p>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(section.content.subsections).map(([key, subsection]) => (
                <AccordionItem key={key} value={key} className="border rounded-lg p-2 mb-2">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col items-start text-left">
                      <h4 className="text-md font-medium">{subsection.title}</h4>
                      <p className="text-sm text-gray-600">{subsection.description}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: subsection.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                      {subsection.sources.length > 0 && (
                        <div className="mt-4">
                          <h5 className="text-sm font-medium mb-2">Sources:</h5>
                          <ul className="space-y-1">
                            {subsection.sources.map((source, idx) => (
                              <li key={idx}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          <p className="text-gray-600 italic">Content not available yet</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export const DeepResearchTest = () => {
  const [query, setQuery] = useState('');
  const [numSections, setNumSections] = useState(6);
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
    await performResearch({ 
      query,
      number_of_main_sections: numSections
    });
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
          <Input
            type="number"
            min={1}
            max={12}
            value={numSections}
            onChange={(e) => setNumSections(parseInt(e.target.value))}
            className="w-24"
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

      {result && result.sections && result.sections.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Research Results</h2>
          <ScrollArea className="h-[600px] pr-4">
            <Accordion type="single" collapsible className="w-full">
              {result.sections.map((section: Section, index: number) => (
                <SectionDisplay key={index} section={section} />
              ))}
            </Accordion>
          </ScrollArea>
        </Card>
      )}

      {result && result.steps && result.steps.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Research Steps</h2>
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
        </Card>
      )}
    </div>
  );
}; 