'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { authService } from '../services/auth-service';

export const useAuth = () => {
  const { user, status, error, initializeAuthListener } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return () => unsubscribe();
  }, [initializeAuthListener]);

  return {
    user,
    isLoading: status === 'loading',
    error,
    isAuthenticated: !!user,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
    signInWithGoogle: authService.signInWithGoogle,
    resetPassword: authService.resetPassword,
  };
}; 