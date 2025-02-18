'use client';

import { ReactNode, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { useAuthStore, SignInCredentials, SignUpCredentials } from '../stores/auth-store';
import { auth } from '@/shared/services/firebase/config';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { 
    setUser, 
    setInitialized,
  } = useAuthStore();

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [setUser, setInitialized]);

  // Implement auth actions
  useEffect(() => {
    // Sign in implementation
    useAuthStore.setState({
      signIn: async (credentials: SignInCredentials) => {
        const result = await signInWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password
        );
        return result;
      },
    });

    // Sign up implementation
    useAuthStore.setState({
      signUp: async (credentials: SignUpCredentials) => {
        const result = await createUserWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password
        );
        
        if (credentials.displayName) {
          await updateProfile(result.user, {
            displayName: credentials.displayName,
          });
        }
        
        return result;
      },
    });

    // Sign out implementation
    useAuthStore.setState({
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    });

    // Reset password implementation
    useAuthStore.setState({
      resetPassword: async (email: string) => {
        await sendPasswordResetEmail(auth, email);
      },
    });
  }, []);

  return <>{children}</>;
} 