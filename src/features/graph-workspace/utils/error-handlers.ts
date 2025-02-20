import { toast } from 'sonner';

interface ErrorHandlerOptions {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  toastId?: string;
}

export const handleAsyncOperation = async <T>(
  operation: () => Promise<T>,
  {
    loadingMessage = 'Processing...',
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    toastId = 'async-operation'
  }: ErrorHandlerOptions = {}
): Promise<T | null> => {
  try {
    toast.loading(loadingMessage, { id: toastId });
    const result = await operation();
    toast.success(successMessage, { id: toastId });
    return result;
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    toast.error(errorMessage, { id: toastId });
    return null;
  }
};

export const validateGraphOperation = (
  graph: unknown,
  operation: string
): void => {
  if (!graph) {
    throw new Error(`Graph not found for ${operation}`);
  }
}; 