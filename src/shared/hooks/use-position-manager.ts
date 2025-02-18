import { useMemo } from 'react';
import { createPositionManager } from '../services/position-manager';

export const usePositionManager = () => {
  return useMemo(() => createPositionManager(), []);
}; 