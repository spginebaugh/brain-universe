import type { StandardsData } from '@/features/graph-map/types/standard';
import { Position, BoundaryCircle } from '@/features/graph-map/types/graph';

export interface NodeState {
  activeRootNodes: Set<string>;
  visibleNodes: Set<string>;
}

export interface LayoutState {
  nodePositions: Map<string, Position>;
  boundaryCircles: Map<string, BoundaryCircle>;
}

export interface UIState {
  isMenuOpen: boolean;
  zoomLevel: number;
  placementMode: {
    active: boolean;
    nodeId: string | null;
  };
}

export interface NodeActions {
  addRootNode: (
    nodeId: string,
    childNodeIds: string[],
    position: Position,
    standards: StandardsData['data']['standards']
  ) => void;
}

export interface LayoutActions {
  isNodeWithinBoundary: (nodeId: string, newPosition: Position) => boolean;
}

export interface UIActions {
  toggleMenu: (isOpen?: boolean) => void;
  enterPlacementMode: (nodeId: string) => void;
  exitPlacementMode: () => void;
  setZoomLevel: (zoom: number) => void;
}

export interface GraphStore extends NodeState, LayoutState, UIState, NodeActions, LayoutActions, UIActions {} 