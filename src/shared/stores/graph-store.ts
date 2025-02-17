import { create } from 'zustand';

interface GraphStore {
  activeRootNodes: Set<string>;
  visibleNodes: Set<string>;
  isMenuOpen: boolean;
  addRootNode: (nodeId: string, childNodeIds: string[]) => void;
  toggleMenu: (isOpen?: boolean) => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  activeRootNodes: new Set(),
  visibleNodes: new Set(),
  isMenuOpen: false,
  addRootNode: (nodeId: string, childNodeIds: string[]) => 
    set((state) => {
      const newActiveRootNodes = new Set(state.activeRootNodes);
      newActiveRootNodes.add(nodeId);
      
      const newVisibleNodes = new Set(state.visibleNodes);
      newVisibleNodes.add(nodeId);
      childNodeIds.forEach(id => newVisibleNodes.add(id));
      
      return {
        activeRootNodes: newActiveRootNodes,
        visibleNodes: newVisibleNodes,
      };
    }),
  toggleMenu: (isOpen?: boolean) =>
    set((state) => ({
      isMenuOpen: isOpen ?? !state.isMenuOpen,
    })),
})); 