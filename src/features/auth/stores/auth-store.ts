'use client';

import { create } from 'zustand';
import { User, UserCredential } from 'firebase/auth';
import { AuthError, AuthStatus, AUTH_STATUS } from '../types/errors';
import { authService, SignInCredentials, SignUpCredentials } from '../services/auth-service';

interface AuthState {
  // State
  user: User | null;
  status: AuthStatus;
  error: AuthError | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  
  // State setters
  setUser: (user: User | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: AuthError | null) => void;
  setInitialized: (isInitialized: boolean) => void;
  
  // Auth actions
  signIn: (credentials: SignInCredentials) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  signUp: (credentials: SignUpCredentials) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // Utility actions
  clearError: () => void;
  reset: () => void;

  // Auth listener
  initializeAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // Initial state
  user: null,
  status: AUTH_STATUS.IDLE,
  error: null,
  isInitialized: false,
  isAuthenticated: false,

  // State setters
  setUser: (user) => set({ 
    user,
    isAuthenticated: !!user,
    status: AUTH_STATUS.SUCCESS,
    error: null 
  }),
  
  setStatus: (status) => set({ status }),
  
  setError: (error) => set({ 
    error,
    status: AUTH_STATUS.ERROR 
  }),
  
  setInitialized: (isInitialized) => set({ isInitialized }),

  // Auth actions
  signIn: async (credentials) => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      const result = await authService.signIn(credentials);
      set({ 
        user: result.user,
        isAuthenticated: true,
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
      return result;
    } catch (error) {
      set({ 
        error: error as AuthError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      const result = await authService.signInWithGoogle();
      set({ 
        user: result.user,
        isAuthenticated: true,
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
      return result;
    } catch (error) {
      set({ 
        error: error as AuthError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  signUp: async (credentials) => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      const result = await authService.signUp(credentials);
      set({ 
        user: result.user,
        isAuthenticated: true,
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
      return result;
    } catch (error) {
      set({ 
        error: error as AuthError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      await authService.signOut();
      set({ 
        user: null,
        isAuthenticated: false,
        error: null,
        status: AUTH_STATUS.SUCCESS 
      });
    } catch (error) {
      set({ 
        error: error as AuthError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  resetPassword: async (email) => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      await authService.resetPassword(email);
      set({ 
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
    } catch (error) {
      set({ 
        error: error as AuthError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  // Utility actions
  clearError: () => set({ error: null }),
  
  reset: () => set({ 
    user: null,
    status: AUTH_STATUS.IDLE,
    error: null,
    isAuthenticated: false,
    isInitialized: false
  }),

  // Auth listener initialization
  initializeAuthListener: () => {
    return authService.initializeAuthListener((user) => {
      set({ 
        user,
        isAuthenticated: !!user,
        status: AUTH_STATUS.SUCCESS,
        isInitialized: true,
        error: null 
      });
    });
  },
}));

// Selector hooks for common auth states
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useIsAuthLoading = () => useAuthStore((state) => state.status === AUTH_STATUS.LOADING); 