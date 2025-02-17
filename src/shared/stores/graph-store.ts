import { create } from 'zustand';
import { createNodeSlice } from './graph/node-slice';
import { createLayoutSlice } from './graph/layout-slice';
import { createUISlice } from './graph/ui-slice';
import type { GraphStore } from './graph/types';

// Create store by combining slices
export const useGraphStore = create<GraphStore>()((set, get, store) => ({
  ...createNodeSlice(set, get, store),
  ...createLayoutSlice(set, get, store),
  ...createUISlice(set, get, store),
})); 