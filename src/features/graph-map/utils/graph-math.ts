import { createGeometryService } from '@/shared/services/geometry';
import { createPositionManager } from '@/shared/services/position-manager';

// Create singleton instances
const geometryService = createGeometryService();
const positionManager = createPositionManager();

// Export the utility functions
export const {
  polarToCartesian,
  getDistance,
} = geometryService;

export const {
  findNonOverlappingPosition,
  calculateCircularLayout,
} = positionManager; 