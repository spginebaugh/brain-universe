'use client';

import { ReactNode, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useAuthStore } from '../stores/auth-store';
import { authService } from '../services/auth-service';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    const unsubscribe = authService.initializeAuthListener((user: User | null) => {
      setUser(user);
    });

    return () => {
      unsubscribe();
    };
  }, [setUser]);

  return <>{children}</>;
} 