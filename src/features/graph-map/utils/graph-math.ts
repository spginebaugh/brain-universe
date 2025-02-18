import { createCoordinateTransform } from '@/shared/services/coordinate-transform';
import { createPositionManager } from '@/shared/services/position-manager';

// Create singleton instances
const transformService = createCoordinateTransform();
const positionManager = createPositionManager();

// Export the utility functions
export const {
  polarToCartesian,
  getDistance,
} = transformService;

export const {
  findNonOverlappingPosition,
  calculateCircularLayout,
} = positionManager; 