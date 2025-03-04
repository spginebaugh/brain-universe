import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkspaceService } from '../services/workspace-service';
import type { WorkspaceState } from '../types/workspace-types';

export const useGraphWorkspace = (userId: string) => {
  const [state, setState] = useState<WorkspaceState>({
    graphs: [],
    isLoading: true,
    error: null,
  });
  
  // Keep a reference to the current workspaceService to avoid recreating it
  const workspaceServiceRef = useRef<WorkspaceService | null>(null);

  // Manual refresh function for cases where we need to explicitly request updates
  const fetchData = useCallback(async () => {
    if (!workspaceServiceRef.current) {
      workspaceServiceRef.current = new WorkspaceService(userId);
    }
    
    try {
      console.log('Manually refreshing graphs for user:', userId);
      const graphs = await workspaceServiceRef.current.fetchAllGraphs();
      console.log('Fetched graphs:', graphs);
      setState({ graphs, isLoading: false, error: null });
    } catch (error) {
      console.error('Error fetching graphs:', error);
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
    }
  }, [userId]);

  useEffect(() => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Create or reuse the workspace service
    if (!workspaceServiceRef.current) {
      workspaceServiceRef.current = new WorkspaceService(userId);
    }
    
    console.log('Setting up real-time graph subscription for user:', userId);
    
    // Subscribe to real-time updates
    const unsubscribe = workspaceServiceRef.current.subscribeToGraphs((graphs) => {
      console.log('Received real-time graph update:', graphs);
      setState({ graphs, isLoading: false, error: null });
    });
    
    // Clean up listener on unmount or when userId changes
    return () => {
      console.log('Cleaning up graph subscription');
      unsubscribe();
    };
  }, [userId]);

  return { ...state, refresh: fetchData };
}; 