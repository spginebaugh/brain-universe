import { Info, Bot, EyeOff, Eye, PlayCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Node, useReactFlow, useStoreApi } from '@xyflow/react';
import { FlowNodeData } from '../types/workspace-types';
import { useEffect, useState } from 'react';
import { RoadmapGeneration } from '../../roadmap-generation/components/roadmap-generation';

interface NodeMenuProps {
  node: Node<FlowNodeData>;
  onInfoClick: () => void;
  onClose: () => void;
  onToggleVisibility: () => void;
  onStartAnimation: () => void;
  areNodesHidden: boolean;
}

export const NodeMenu = ({ node, onInfoClick, onClose, onToggleVisibility, onStartAnimation, areNodesHidden }: NodeMenuProps) => {
  const { getNode } = useReactFlow();
  const store = useStoreApi();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isRoadmapDialogOpen, setIsRoadmapDialogOpen] = useState(false);
  const [isRootNode, setIsRootNode] = useState(false);

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

    // Check if this is a root node
    const currentNode = getNode(node.id);
    if (currentNode) {
      setIsRootNode(currentNode.style?.background === '#e0f2e9');
    }

    return () => {
      unsubscribe();
    };
  }, [node.id, getNode, store]);

  return (
    <>
      <div
        className="absolute z-50 flex gap-2"
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
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-lg hover:bg-blue-100"
          onClick={() => setIsRoadmapDialogOpen(true)}
        >
          <Bot className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-lg hover:bg-blue-100"
          onClick={onToggleVisibility}
          title={areNodesHidden ? "Show all nodes and edges" : "Hide non-root nodes and edges"}
        >
          {areNodesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
        {areNodesHidden && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full shadow-lg hover:bg-green-100"
            onClick={onStartAnimation}
            title="Animate node reveal sequence"
          >
            <PlayCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      <RoadmapGeneration
        node={node}
        isOpen={isRoadmapDialogOpen}
        onOpenChange={setIsRoadmapDialogOpen}
        onClose={onClose}
        isRootNode={isRootNode}
      />
    </>
  );
}; 