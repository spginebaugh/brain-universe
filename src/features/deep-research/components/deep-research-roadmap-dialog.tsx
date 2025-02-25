import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { useDeepResearchRoadmapStore } from '../stores/deep-research-roadmap-store';

interface DeepResearchRoadmapDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onComplete: () => void;
  showProgress?: boolean;
}

export function DeepResearchRoadmapDialog({
  isOpen,
  onOpenChange,
  onCancel,
  onComplete,
  showProgress = true,
}: DeepResearchRoadmapDialogProps) {
  // Get state from the store
  const {
    isLoading,
    error,
    progress,
    currentPhaseLabel,
    cancelRequested,
    requestCancel,
  } = useDeepResearchRoadmapStore();

  // Handle dialog close
  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      onComplete();
    }
  };

  // Handle cancel request
  const handleCancel = () => {
    if (isLoading) {
      requestCancel();
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>
          Deep Research Roadmap Generation
          {isLoading && <span className="text-blue-500 ml-2">Processing...</span>}
        </DialogTitle>
        
        <div className="py-6">
          {error ? (
            <div className="text-red-500 mb-4">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {showProgress && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {isLoading ? currentPhaseLabel : 'Complete'}
                    </p>
                    {isLoading && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  
                  <Progress 
                    value={progress} 
                    className="h-2 w-full"
                  />
                  
                  <p className="text-xs text-gray-500">
                    {progress}% Complete
                  </p>
                </>
              )}
              
              {!isLoading && !error && (
                <p className="text-green-600">
                  Research complete! The roadmap has been generated successfully.
                </p>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="sm:justify-end">
          {isLoading ? (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelRequested}
            >
              {cancelRequested ? 'Cancelling...' : 'Cancel'}
            </Button>
          ) : (
            <Button
              onClick={handleClose}
            >
              {error ? 'Close' : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 