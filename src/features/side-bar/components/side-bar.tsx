'use client';

import { Plus, Network } from 'lucide-react';
import { useGraphStore } from '@/shared/stores/graph-store';

interface SideBarProps {
  className?: string;
}

export const SideBar = ({ className = '' }: SideBarProps) => {
  const { toggleMenu } = useGraphStore();

  return (
    <div 
      className={`w-16 h-screen bg-gray-900 fixed left-0 top-0 flex flex-col items-center gap-4 py-4 ${className}`}
    >
      <button
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors opacity-50 cursor-not-allowed"
        title="Add Solar System (Coming Soon)"
        disabled
      >
        <Plus className="w-6 h-6" />
      </button>

      <button
        onClick={() => toggleMenu(true)}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Add Graph Node"
      >
        <Network className="w-6 h-6" />
      </button>
    </div>
  );
};

export default SideBar; 