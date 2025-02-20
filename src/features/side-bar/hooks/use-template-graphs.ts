import { useEffect, useState } from 'react';
import { TemplateService } from '@/shared/services/firebase/template-service';
import { TemplateGraph } from '@/shared/types/template-types';

interface UseTemplateGraphsResult {
  data: TemplateGraph[] | null;
  isLoading: boolean;
  error: Error | null;
}

export const useTemplateGraphs = (): UseTemplateGraphsResult => {
  const [data, setData] = useState<TemplateGraph[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        // Initialize with Texas TEKS Math templates - this could be made configurable
        const templateService = new TemplateService('texas_TEKS', 'Math');
        const templates = await templateService.getAll();
        setData(templates);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch templates'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  return { data, isLoading, error };
}; 