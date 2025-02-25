'use client';

import { useState } from 'react';
import { useNodeSelectionStore } from '../stores/node-selection-store';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { useReactFlow } from '@xyflow/react';
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

interface MultiNodeColorMenuProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const MultiNodeColorMenu = ({ userId, isOpen, onClose }: MultiNodeColorMenuProps) => {
  const { selectedNodes, clearSelectedNodes } = useNodeSelectionStore();
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0].value);
  const reactFlowInstance = useReactFlow();
  const graphService = new GraphService(userId);
  
  const handleColorChange = async () => {
    if (selectedNodes.length === 0) {
      toast.error('No nodes selected');
      onClose();
      return;
    }

    try {
      toast.loading('Updating node colors...');
      
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
          // First get the current node to preserve existing metadata
          return graphService.getNode(graphId, nodeId).then(node => {
            if (node) {
              const updatedMetadata = {
                ...node.metadata,
                backgroundColor: selectedColor
              };
              
              return graphService.updateNode(graphId, nodeId, {
                metadata: updatedMetadata
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
          // Make sure we have a metadata object
          const metadata = node.data.metadata || {};
          
          return {
            ...node,
            data: {
              ...node.data,
              metadata: {
                ...metadata,
                backgroundColor: selectedColor
              }
            }
          };
        }
        return node;
      });
      
      reactFlowInstance.setNodes(updatedNodes);
      
      toast.dismiss();
      toast.success('Node colors updated successfully');
      clearSelectedNodes();
      onClose();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to update node colors');
      console.error('Error updating node colors:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Color for {selectedNodes.length} Selected Nodes</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="color">Select Color</Label>
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
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleColorChange}>
            Apply Color
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiNodeColorMenu; 