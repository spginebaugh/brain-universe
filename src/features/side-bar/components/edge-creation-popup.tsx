import { useEdgeCreationStore } from '../stores/edge-creation-store';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { useCallback } from 'react';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { v4 as uuidv4 } from 'uuid';
import { DbEdge } from '@/shared/types/db-types';

interface EdgeCreationPopupProps {
  userId: string;
  onCancel: () => void;
}

export const EdgeCreationPopup = ({ userId, onCancel }: EdgeCreationPopupProps) => {
  const { 
    isCreationMode,
    selectedFirstNodeId,
    selectedGraphId,
    resetSelection 
  } = useEdgeCreationStore();

  const handleSecondNodeSelection = useCallback(async (secondNodeId: string, secondNodeGraphId: string) => {
    if (!selectedFirstNodeId || !selectedGraphId) return;
    
    // Verify both nodes are from the same graph
    if (selectedGraphId !== secondNodeGraphId) {
      alert('Error: Both nodes must be from the same graph');
      resetSelection();
      return;
    }

    try {
      const graphService = new GraphService(userId);
      
      const newEdge: DbEdge = {
        edgeId: uuidv4(),
        fromNodeId: selectedFirstNodeId,
        toNodeId: secondNodeId,
        isDirected: true,
        relationshipType: 'tree_edge',
        __db: {} as const // Add nominal typing for DbEdge
      };

      await graphService.createEdge(selectedGraphId, newEdge);
      resetSelection();
    } catch (error) {
      console.error('Failed to create edge:', error);
      alert('Failed to create edge. Please try again.');
      resetSelection();
    }
  }, [selectedFirstNodeId, selectedGraphId, userId, resetSelection]);

  if (!isCreationMode) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
      <Alert className="bg-white/90 backdrop-blur-sm border-blue-200 shadow-lg">
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            {!selectedFirstNodeId 
              ? "Select First Node" 
              : "Select Second Node from the same graph"}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCancel}
          >
            Cancel
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}; 