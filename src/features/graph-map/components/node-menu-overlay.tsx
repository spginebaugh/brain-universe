'use client';

import { X } from 'lucide-react';
import { useDrag } from 'react-dnd';
import { useGraphStore } from '@/shared/stores/graph-store';
import { Standard } from '../types/standard';
import type { DragSourceMonitor } from 'react-dnd';

interface DraggableNodeItemProps {
  node: Standard;
  isActive: boolean;
}

const DraggableNodeItem = ({ node, isActive }: DraggableNodeItemProps) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'NODE',
    item: { id: node.id },
    canDrag: !isActive,
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        if (typeof drag === 'function') {
          drag(node);
        }
      }}
      className={`
        p-4 mb-2 rounded-lg border-2 cursor-move
        ${isActive 
          ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
          : 'bg-white border-gray-300 hover:border-blue-500 hover:shadow-lg'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
    >
      <p className="text-sm font-medium text-gray-900">{node.description}</p>
    </div>
  );
};

interface NodeMenuOverlayProps {
  nodes: Standard[];
}

export const NodeMenuOverlay = ({ nodes }: NodeMenuOverlayProps) => {
  const { isMenuOpen, activeRootNodes, toggleMenu } = useGraphStore();

  if (!isMenuOpen) return null;

  const depth1Nodes = nodes.filter(node => node.depth === 1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] relative">
        <button
          onClick={() => toggleMenu(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-semibold mb-4">Available Nodes</h2>
        
        <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
          {depth1Nodes.map((node) => (
            <DraggableNodeItem
              key={node.id}
              node={node}
              isActive={activeRootNodes.has(node.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 