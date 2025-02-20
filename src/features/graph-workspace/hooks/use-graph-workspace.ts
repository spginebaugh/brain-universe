import { useState, useEffect } from 'react';
import { WorkspaceService } from '../services/workspace-service';
import type { WorkspaceState } from '../types/workspace-types';

export const useGraphWorkspace = (userId: string) => {
  const [state, setState] = useState<WorkspaceState>({
    graphs: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const workspaceService = new WorkspaceService(userId);

    const fetchData = async () => {
      try {
        console.log('Fetching graphs for user:', userId);
        const graphs = await workspaceService.fetchAllGraphs();
        console.log('Fetched graphs:', graphs);
        setState({ graphs, isLoading: false, error: null });
      } catch (error) {
        console.error('Error fetching graphs:', error);
        setState({ graphs: [], isLoading: false, error: error as Error });
      }
    };

    fetchData();
  }, [userId]);

  return state;
}; 