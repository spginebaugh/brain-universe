'use client';

import { useEffect } from 'react';
import { initializeFirebaseServices } from '@/shared/services/firebase/config';
import { authService } from '@/features/auth';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Initialize Firebase services on the client side
    initializeFirebaseServices();
    
    // Initialize auth listener
    const unsubscribe = authService.initializeAuthListener();
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        {children}
      </DndProvider>
    </QueryClientProvider>
  );
} 