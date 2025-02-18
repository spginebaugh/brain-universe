import { useMemo } from 'react';
import { createBoundaryManager } from '../services/boundary-manager';

export const useBoundaryManager = () => {
  return useMemo(() => createBoundaryManager(), []);
}; 