import { Info } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Node, useReactFlow, useStoreApi } from '@xyflow/react';
import { FlowNodeData } from '../types/workspace-types';
import { useEffect, useState } from 'react';

interface NodeMenuProps {
  node: Node<FlowNodeData>;
  onInfoClick: () => void;
  onClose: () => void;
}

export const NodeMenu = ({ node, onInfoClick }: NodeMenuProps) => {
  const { getNode } = useReactFlow();
  const store = useStoreApi();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = () => {
      const currentNode = getNode(node.id);
      if (!currentNode) return;

      // Get the current viewport transform
      const { transform } = store.getState();
      const zoom = transform[2];

      // Calculate position in viewport coordinates
      const x = currentNode.position.x * zoom + transform[0] + (currentNode.width || 0) * zoom / 2;
      const y = currentNode.position.y * zoom + transform[1] - 20 * zoom;

      setPosition({ x, y });
    };

    // Update position initially
    updatePosition();

    // Subscribe to viewport changes
    const unsubscribe = store.subscribe(updatePosition);

    return () => {
      unsubscribe();
    };
  }, [node.id, getNode, store]);

  return (
    <div
      className="absolute z-50"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transformOrigin: 'center bottom'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8 rounded-full shadow-lg hover:bg-blue-100"
        onClick={onInfoClick}
      >
        <Info className="h-4 w-4" />
      </Button>
    </div>
  );
}; 