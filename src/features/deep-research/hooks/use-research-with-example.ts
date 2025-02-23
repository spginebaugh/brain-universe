"use client";

import { useState } from 'react';
import { useResearch } from './use-research';
import type { Section, SubSection } from '../types/research';
import exampleOutput from '../components/example_output.json';

// Transform the example data to match our types
function transformExampleData(data: typeof exampleOutput): Section[] {
  return data.completedSections.map(section => ({
    title: section.title,
    description: section.description,
    subsectionTitles: section.subsectionTitles,
    content: section.content ? {
      overview: section.content.overview,
      subsections: Object.entries(section.content.subsections).reduce((acc, [key, subsection]) => {
        acc[key] = {
          title: subsection.title,
          description: subsection.description,
          content: subsection.content,
          sources: subsection.sources
        };
        return acc;
      }, {} as Record<string, SubSection>)
    } : undefined
  }));
}

export function useResearchWithExample() {
  const [useExample, setUseExample] = useState(false);
  const research = useResearch();

  const loadExample = () => {
    setUseExample(true);
  };

  if (useExample) {
    const exampleSections = transformExampleData(exampleOutput);
    return {
      ...research,
      sections: [],
      currentSessionId: 'example',
      isLoading: false,
      error: null,
      getSession: () => ({
        state: {
          sections: [],
          completedSections: exampleSections,
          topic: '',
          numberOfMainSections: 6,
          section: null,
          searchIterations: 0,
          searchQueries: [],
          sourceStr: '',
          reportSectionsFromResearch: ''
        },
        config: research.getSession(research.currentSessionId || '')?.config || {},
        events: []
      }),
      loadExample
    };
  }

  return {
    ...research,
    loadExample
  };
} 