'use client';

import { useEffect } from 'react';
import { initializeFirebaseServices } from '@/shared/services/firebase/config';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const initializeAuthListener = useAuthStore(state => state.initializeAuthListener);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize Firebase services on the client side
      initializeFirebaseServices();
      
      // Initialize auth listener from the store
      const unsubscribe = initializeAuthListener();
      return () => unsubscribe();
    }
  }, [initializeAuthListener]);

  return (
    <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        {children}
      </DndProvider>
    </QueryClientProvider>
  );
} 