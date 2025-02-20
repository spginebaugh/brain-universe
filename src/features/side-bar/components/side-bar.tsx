'use client';

import { Network, ShoppingCart, Plus } from 'lucide-react';
import { useTemplateGraphs } from '@/features/side-bar/hooks/use-template-graphs';
import { useShopStore } from '@/features/shop-panel/stores/shop-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { TemplateGraph } from '@/shared/types/template-types';
import { useTemplateSelectionStore } from '../stores/template-selection-store';
import { useRootNodeCreationStore } from '../stores/root-node-creation-store';

interface SideBarProps {
  className?: string;
}

export const SideBar = ({ className = '' }: SideBarProps) => {
  const { data: templates, isLoading } = useTemplateGraphs();
  const { toggleShop } = useShopStore();
  const { setSelectedTemplate } = useTemplateSelectionStore();
  const { setCreationMode } = useRootNodeCreationStore();

  return (
    <div 
      className={`w-16 h-screen bg-gray-900 fixed left-0 top-0 flex flex-col items-center gap-4 py-4 ${className}`}
    >
      <button
        onClick={() => setCreationMode(true)}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Create New Root Node"
      >
        <Plus className="w-6 h-6" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Add Graph Template"
          >
            <Network className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <DropdownMenuItem disabled>
              Loading templates...
            </DropdownMenuItem>
          ) : templates?.map((template: TemplateGraph) => (
            <DropdownMenuItem
              key={template.graphId}
              onClick={() => setSelectedTemplate(template.graphId)}
              className="flex flex-col items-start gap-1"
            >
              <span className="font-medium">{template.graphName}</span>
              <span className="text-sm text-gray-500">{template.properties.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={toggleShop}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Shop"
      >
        <ShoppingCart className="w-6 h-6" />
      </button>
    </div>
  );
};

export default SideBar; 