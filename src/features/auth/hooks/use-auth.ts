'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { authService } from '../services/auth-service';

export const useAuth = () => {
  const { user, isLoading, error } = useAuthStore();

  useEffect(() => {
    const unsubscribe = authService.initializeAuthListener();
    return () => unsubscribe();
  }, []);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
    signInWithGoogle: authService.signInWithGoogle,
    resetPassword: authService.resetPassword,
  };
}; 