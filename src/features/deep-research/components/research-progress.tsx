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
  const { isLoading, error, currentSessionId, getSession, startResearch, chapters } = useResearch();
  
  // Get session directly
  const session = currentSessionId ? getSession(currentSessionId) : undefined;
  console.log('Current session in component:', session); // Debug log
  
  // Use chapters from the hook, which now gets them from state.chapters
  console.log('Chapters:', chapters); // Debug log

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
    currentSessionId, 
    chaptersLength: chapters.length,
    availableSessions: session ? 'Session found' : 'No session'
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
          sessionId={currentSessionId ? currentSessionId : undefined} 
        />
      )}
      
      {isLoading && <LoadingState />}

      <ResearchResults 
        groupedChapters={groupedChapters}
        isLoading={isLoading}
      />
    </div>
  );
} 