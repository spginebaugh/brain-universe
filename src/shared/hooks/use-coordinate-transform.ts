import { useMemo } from 'react';
import { createGeometryService } from '../services/geometry';

export const useCoordinateTransform = () => {
  return useMemo(() => {
    const geometryService = createGeometryService();
    
    // Return only the coordinate transformation related functions
    return {
      polarToCartesian: geometryService.polarToCartesian,
      cartesianToPolar: geometryService.cartesianToPolar,
      getDistance: geometryService.getDistance,
      screenToFlow: geometryService.screenToFlow,
      flowToScreen: geometryService.flowToScreen,
      applyViewportTransform: geometryService.applyViewportTransform,
      getInverseScaleWithConstraints: geometryService.getInverseScaleWithConstraints,
    };
  }, []);
}; 