"use client";

import React, { useState } from 'react';
import { useResearch } from '../hooks/use-research';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';

export function ResearchFeedback() {
  const [feedback, setFeedback] = useState('');
  const { isLoading, error, provideFeedback } = useResearch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    await provideFeedback(feedback.trim());
    setFeedback('');
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Provide Feedback</h3>
          <p className="text-gray-600 mb-4">
            Your feedback will help guide the research process. Please provide any
            specific instructions or clarifications.
          </p>
        </div>

        {error && (
          <div className="text-red-500 p-2 rounded bg-red-50">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter your feedback..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !feedback.trim()}>
            {isLoading ? 'Sending...' : 'Send Feedback'}
          </Button>
        </div>
      </form>
    </Card>
  );
} 