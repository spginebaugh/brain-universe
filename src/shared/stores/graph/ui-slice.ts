import { StateCreator } from 'zustand';
import { UIState, UIActions, GraphStore } from './types';

export const createUISlice: StateCreator<
  GraphStore,
  [],
  [],
  UIState & UIActions
> = (set) => ({
  isMenuOpen: false,
  zoomLevel: 1,
  placementMode: {
    active: false,
    nodeId: null,
  },

  toggleMenu: (isOpen?: boolean) =>
    set((state) => ({
      isMenuOpen: isOpen ?? !state.isMenuOpen,
    })),

  enterPlacementMode: (nodeId: string) =>
    set(() => ({
      placementMode: {
        active: true,
        nodeId,
      },
      isMenuOpen: false,
    })),

  exitPlacementMode: () =>
    set(() => ({
      placementMode: {
        active: false,
        nodeId: null,
      },
    })),

  setZoomLevel: (zoom: number) =>
    set(() => ({
      zoomLevel: zoom,
    })),
}); 