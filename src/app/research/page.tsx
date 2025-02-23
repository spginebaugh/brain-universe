import { ResearchProgress } from '@/features/deep-research/components/research-progress';

export default function ResearchPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Deep Research</h1>
        <p className="text-gray-600 mb-8">
          Enter a topic to generate a comprehensive research report with multiple sections.
        </p>
      </div>

      <ResearchProgress />
    </div>
  );
} 