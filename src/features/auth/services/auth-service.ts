import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/shared/services/firebase/config';
import { useAuthStore } from '../stores/auth-store';
import { AUTH_STATUS } from '../types/errors';

const googleProvider = new GoogleAuthProvider();

interface AuthCredentials {
  email: string;
  password: string;
}

export const authService = {
  initializeAuthListener: () => {
    const { setUser, setStatus } = useAuthStore.getState();

    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setStatus(AUTH_STATUS.IDLE);
    });
  },

  signUp: async ({ email, password }: AuthCredentials): Promise<User> => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      return user;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign up');
    }
  },

  signIn: async ({ email, password }: AuthCredentials): Promise<User> => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in');
    }
  },

  signInWithGoogle: async (): Promise<User> => {
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      return user;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in with Google');
    }
  },

  signOut: async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign out');
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to reset password');
    }
  },
}; 