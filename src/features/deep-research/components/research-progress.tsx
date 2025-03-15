"use client";

import React, { useState } from 'react';
import { useResearch } from '../hooks/use-research';
import { RESEARCH_PHASES } from '../types/research';
import type { ResearchPhase, Chapter } from '../types/research';
import {
  ResearchForm,
  ResearchResults,
  ErrorDisplay,
  LoadingState
} from './research-ui-components';

/**
 * Main research progress component that manages state and renders UI components
 */
export function ResearchProgress() {
  const [query, setQuery] = useState('');
  const [numberOfChapters, setNumberOfChapters] = useState(6);
  const { isLoading, error, sessionId, startResearch, chapters, progress, currentPhase } = useResearch();
  
  // Log debug info
  console.log('Research progress:', { sessionId, progress, currentPhase });
  console.log('Chapters:', chapters);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    console.log('Starting research with query:', query, 'chapters:', numberOfChapters);
    
    try {
      await startResearch({
        query: query.trim(),
        numberOfChapters: numberOfChapters
      });
    } catch (err) {
      console.error('Error starting research:', err);
    }
  };

  // Log render state
  console.log('Render state:', { 
    isLoading, 
    error, 
    sessionId, 
    chaptersLength: chapters.length,
    progress,
    currentPhase
  });

  // Group chapters by phase
  const groupedChapters = chapters.reduce((acc, chapter) => {
    const phase = chapter.phase || RESEARCH_PHASES.CHAPTER_RESEARCH;
    if (!acc[phase]) {
      acc[phase] = [];
    }
    acc[phase].push(chapter);
    return acc;
  }, {} as Record<ResearchPhase, Chapter[]>);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <ResearchForm
        query={query}
        setQuery={setQuery}
        numberOfChapters={numberOfChapters}
        setNumberOfChapters={setNumberOfChapters}
        isLoading={isLoading}
        onSubmit={handleSubmit}
      />

      {error && (
        <ErrorDisplay 
          error={error} 
          sessionId={sessionId ?? undefined} 
        />
      )}
      
      {isLoading && <LoadingState />}

      <ResearchResults 
        groupedChapters={groupedChapters}
        isLoading={isLoading}
        progress={progress}
        currentPhase={currentPhase}
      />
    </div>
  );
} 