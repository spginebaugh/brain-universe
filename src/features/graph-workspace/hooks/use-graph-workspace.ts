import { useState, useEffect } from 'react';
import { WorkspaceService } from '../services/workspace-service';
import type { WorkspaceState } from '../types/workspace-types';

export const useGraphWorkspace = (userId: string, graphId: string) => {
  const [state, setState] = useState<WorkspaceState>({
    graph: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const workspaceService = new WorkspaceService(userId, graphId);

    const fetchData = async () => {
      try {
        const graph = await workspaceService.fetchWorkspaceData();
        setState({ graph, isLoading: false, error: null });
      } catch (error) {
        setState({ graph: null, isLoading: false, error: error as Error });
      }
    };

    fetchData();
  }, [userId, graphId]);

  return state;
}; 