'use client';

import { Network, ShoppingCart } from 'lucide-react';
import { useGraphStore } from '@/shared/stores/graph-store';
import { useStandardsData } from '@/shared/hooks/use-standards-data';
import { useShopStore } from '@/shared/stores/shop-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';

interface SideBarProps {
  className?: string;
}

export const SideBar = ({ className = '' }: SideBarProps) => {
  const { enterPlacementMode } = useGraphStore();
  const { data: standardsData } = useStandardsData();
  const { toggleShop } = useShopStore();

  const handleNodeSelect = (nodeId: string) => {
    if (standardsData) {
      enterPlacementMode(nodeId);
    }
  };

  const depth1Nodes = standardsData 
    ? Object.values(standardsData.data.standards).filter(node => node.depth === 1)
    : [];

  return (
    <div 
      className={`w-16 h-screen bg-gray-900 fixed left-0 top-0 flex flex-col items-center gap-4 py-4 ${className}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Add Graph Node"
          >
            <Network className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
          {depth1Nodes.map((node) => (
            <DropdownMenuItem
              key={node.id}
              onClick={() => handleNodeSelect(node.id)}
              className="flex flex-col items-start gap-1"
            >
              <span className="font-medium">{node.description}</span>
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