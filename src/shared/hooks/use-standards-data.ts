import { useQuery } from '@tanstack/react-query';
import { fetchStandardsData } from '@/features/graph-map/services/standards-service';
import type { StandardsData } from '@/features/graph-map/types/standard';

export const STANDARDS_DATA_QUERY_KEY = ['standards'] as const;

export const useStandardsData = () => {
  return useQuery<StandardsData>({
    queryKey: STANDARDS_DATA_QUERY_KEY,
    queryFn: fetchStandardsData,
  });
}; 