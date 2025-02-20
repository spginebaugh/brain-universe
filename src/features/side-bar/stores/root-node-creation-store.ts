import { create } from 'zustand';

interface RootNodeCreationState {
  isCreationMode: boolean;
  setCreationMode: (isCreating: boolean) => void;
}

export const useRootNodeCreationStore = create<RootNodeCreationState>((set) => ({
  isCreationMode: false,
  setCreationMode: (isCreating: boolean) => 
    set({ isCreationMode: isCreating }),
})); 