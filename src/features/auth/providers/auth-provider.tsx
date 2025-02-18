'use client';

import { ReactNode, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useAuthStore } from '../stores/auth-store';
import { authService } from '../services/auth-service';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.initializeAuthListener((user: User | null) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [setUser]);

  if (isLoading) {
    // You can replace this with a loading spinner or skeleton if desired
    return null;
  }

  return <>{children}</>;
} 