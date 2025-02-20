import { useState, useEffect, useCallback } from 'react';
import { WorkspaceService } from '../services/workspace-service';
import type { WorkspaceState } from '../types/workspace-types';

export const useGraphWorkspace = (userId: string) => {
  const [state, setState] = useState<WorkspaceState>({
    graphs: [],
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const workspaceService = new WorkspaceService(userId);

    try {
      console.log('Fetching graphs for user:', userId);
      const graphs = await workspaceService.fetchAllGraphs();
      console.log('Fetched graphs:', graphs);
      setState({ graphs, isLoading: false, error: null });
    } catch (error) {
      console.error('Error fetching graphs:', error);
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refresh: fetchData };
}; 