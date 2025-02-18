'use client';

import { create } from 'zustand';
import { User, UserCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/shared/services/firebase/config';
import { mapFirebaseError } from '../utils/error-mapper';
import { AuthError, AuthStatus, AUTH_STATUS } from '../types/errors';

// Auth request types
export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  displayName?: string;
}

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
  signUp: (credentials: SignUpCredentials) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // Utility actions
  clearError: () => void;
  reset: () => void;
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
      const result = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );
      set({ 
        user: result.user,
        isAuthenticated: true,
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
      return result;
    } catch (error) {
      const mappedError = mapFirebaseError(error);
      set({ 
        error: mappedError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  signUp: async (credentials) => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      const result = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );

      if (credentials.displayName) {
        await updateProfile(result.user, {
          displayName: credentials.displayName
        });
      }

      set({ 
        user: result.user,
        isAuthenticated: true,
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
      return result;
    } catch (error) {
      const mappedError = mapFirebaseError(error);
      set({ 
        error: mappedError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      await auth.signOut();
      set({ 
        user: null,
        isAuthenticated: false,
        error: null,
        status: AUTH_STATUS.SUCCESS 
      });
    } catch (error) {
      const mappedError = mapFirebaseError(error);
      set({ 
        error: mappedError,
        status: AUTH_STATUS.ERROR 
      });
      throw error;
    }
  },

  resetPassword: async (email) => {
    try {
      set({ status: AUTH_STATUS.LOADING });
      await sendPasswordResetEmail(auth, email);
      set({ 
        status: AUTH_STATUS.SUCCESS,
        error: null
      });
    } catch (error) {
      const mappedError = mapFirebaseError(error);
      set({ 
        error: mappedError,
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
}));

// Selector hooks for common auth states
export const useIsAuthenticated = () => useAuthStore((state: AuthState) => state.isAuthenticated);
export const useAuthUser = () => useAuthStore((state: AuthState) => state.user);
export const useAuthStatus = () => useAuthStore((state: AuthState) => state.status);
export const useAuthError = () => useAuthStore((state: AuthState) => state.error);
export const useIsAuthLoading = () => useAuthStore((state: AuthState) => state.status === AUTH_STATUS.LOADING); 