import { create } from 'zustand';

interface TemplateSelectionState {
  selectedTemplateId: string | null;
  isPlacementMode: boolean;
  setSelectedTemplate: (templateId: string) => void;
  clearSelection: () => void;
}

export const useTemplateSelectionStore = create<TemplateSelectionState>((set) => ({
  selectedTemplateId: null,
  isPlacementMode: false,
  setSelectedTemplate: (templateId: string) => 
    set({ selectedTemplateId: templateId, isPlacementMode: true }),
  clearSelection: () => 
    set({ selectedTemplateId: null, isPlacementMode: false }),
})); 