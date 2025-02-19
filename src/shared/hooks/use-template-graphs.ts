import { useQuery } from '@tanstack/react-query';
import { TemplateService } from '@/shared/services/firebase/template-service';

const templateService = new TemplateService('texas_TEKS', 'Math');

export const TEMPLATE_GRAPHS_QUERY_KEY = ['template-graphs'] as const;

export const useTemplateGraphs = () => {
  return useQuery({
    queryKey: TEMPLATE_GRAPHS_QUERY_KEY,
    queryFn: async () => {
      const templates = await templateService.list();
      return templates;
    },
  });
}; 