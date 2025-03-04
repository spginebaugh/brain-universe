'use client';

import { useState } from 'react';
import { useNodeSelectionStore } from '../stores/node-selection-store';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { useReactFlow, Position } from '@xyflow/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// Predefined color options for node backgrounds - matching NodeInfoDialog
const COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#e0f2e9', label: 'Green (Root)' },
  { value: '#f0f4ff', label: 'Light Blue' },
  { value: '#fff4e6', label: 'Light Orange' },
  { value: '#f3f4f6', label: 'Light Gray' },
  { value: '#fdf2f8', label: 'Light Pink' },
  { value: '#ecfdf5', label: 'Mint' },
  { value: '#fffbeb', label: 'Light Yellow' },
];

// Define a mapping between string position values and Position enum values
const positionMap = {
  'top': Position.Top,
  'right': Position.Right,
  'bottom': Position.Bottom,
  'left': Position.Left
} as const;

type NodeHandlePosition = 'top' | 'right' | 'bottom' | 'left' | null;

const POSITION_OPTIONS: { value: NodeHandlePosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
];

interface MultiNodeColorMenuProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const MultiNodeColorMenu = ({ userId, isOpen, onClose }: MultiNodeColorMenuProps) => {
  const { selectedNodes, clearSelectedNodes } = useNodeSelectionStore();
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0].value);
  const [sourcePosition, setSourcePosition] = useState<NodeHandlePosition>('bottom');
  const [targetPosition, setTargetPosition] = useState<NodeHandlePosition>('top');
  const reactFlowInstance = useReactFlow();
  const graphService = new GraphService(userId);
  
  const handleApplyChanges = async () => {
    if (selectedNodes.length === 0) {
      toast.error('No nodes selected');
      onClose();
      return;
    }

    try {
      toast.loading('Updating nodes...', { id: 'update-nodes' });
      
      // Group nodes by graph ID for batch updates
      const nodesByGraph: Record<string, string[]> = {};
      
      selectedNodes.forEach(node => {
        const graphId = node.data.graphId;
        if (!nodesByGraph[graphId]) {
          nodesByGraph[graphId] = [];
        }
        
        nodesByGraph[graphId].push(node.id);
      });
      
      // Update nodes in Firestore
      const updatePromises = Object.entries(nodesByGraph).flatMap(([graphId, nodeIds]) => {
        return nodeIds.map(nodeId => {
          // First get the current node to preserve existing data
          return graphService.getNode(graphId, nodeId).then(node => {
            if (node) {
              // Update metadata for background color
              const updatedMetadata = {
                ...node.metadata,
                backgroundColor: selectedColor
              };
              
              // Update properties for source and target positions
              const updatedProperties = {
                ...node.properties,
                sourcePosition,
                targetPosition
              };
              
              return graphService.updateNode(graphId, nodeId, {
                metadata: updatedMetadata,
                properties: updatedProperties
              });
            }
            return Promise.resolve();
          });
        });
      });
      
      await Promise.all(updatePromises);
      
      // Update nodes in ReactFlow
      const updatedNodes = reactFlowInstance.getNodes().map(node => {
        if (selectedNodes.some(selectedNode => selectedNode.id === node.id)) {
          // Update node data
          const metadata = node.data.metadata || {};
          const properties = node.data.properties || {};
          
          // Map string position to Position enum values for ReactFlow
          const mappedSourcePosition = sourcePosition ? positionMap[sourcePosition] : undefined;
          const mappedTargetPosition = targetPosition ? positionMap[targetPosition] : undefined;
          
          return {
            ...node,
            data: {
              ...node.data,
              metadata: {
                ...metadata,
                backgroundColor: selectedColor
              },
              properties: {
                ...properties,
                sourcePosition,
                targetPosition
              }
            },
            sourcePosition: mappedSourcePosition,
            targetPosition: mappedTargetPosition
          };
        }
        return node;
      });
      
      reactFlowInstance.setNodes(updatedNodes);
      
      toast.dismiss('update-nodes');
      toast.success('Nodes updated successfully');
      clearSelectedNodes();
      onClose();
    } catch (error) {
      toast.dismiss('update-nodes');
      toast.error('Failed to update nodes');
      console.error('Error updating nodes:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {selectedNodes.length} Selected Nodes</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Color Selection */}
          <div className="grid gap-2">
            <Label htmlFor="color">Node Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${
                    selectedColor === color.value ? 'border-black' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  aria-label={`Select ${color.label} color`}
                  title={color.label}
                />
              ))}
            </div>
          </div>
          
          {/* Source Position Selection */}
          <div className="grid gap-2">
            <Label htmlFor="sourcePosition">Source Position</Label>
            <Select
              value={sourcePosition ?? 'bottom'}
              onValueChange={(value) => setSourcePosition(value as NodeHandlePosition)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source position" />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={option.value ?? ''}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Target Position Selection */}
          <div className="grid gap-2">
            <Label htmlFor="targetPosition">Target Position</Label>
            <Select
              value={targetPosition ?? 'top'}
              onValueChange={(value) => setTargetPosition(value as NodeHandlePosition)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target position" />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={option.value ?? ''}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApplyChanges}>
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiNodeColorMenu; 