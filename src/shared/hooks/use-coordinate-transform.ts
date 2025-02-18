import { useMemo } from 'react';
import { createCoordinateTransform } from '../services/coordinate-transform';

export const useCoordinateTransform = () => {
  return useMemo(() => createCoordinateTransform(), []);
}; 