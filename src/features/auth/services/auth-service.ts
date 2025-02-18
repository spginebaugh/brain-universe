import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential,
  updateProfile,
  Auth,
} from 'firebase/auth';
import { auth } from '@/shared/services/firebase/config';
import { mapFirebaseError } from '../utils/error-mapper';

const googleProvider = new GoogleAuthProvider();

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  displayName?: string;
}

// Re-export types for convenience
export type { AuthCredentials as SignInCredentials };

const ensureAuth = (): Auth => {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth cannot be used on the server side. This method should only be called in client components.');
  }
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. This can happen if you are trying to use auth in a server component.');
  }
  return auth;
};

export const authService = {
  /**
   * Initialize auth state listener
   * @param onAuthStateChange Callback function to handle auth state changes
   * @returns Unsubscribe function
   */
  initializeAuthListener: (onAuthStateChange: (user: User | null) => void) => {
    const authInstance = ensureAuth();
    return onAuthStateChanged(authInstance, onAuthStateChange);
  },

  /**
   * Sign up with email and password
   */
  signUp: async ({ email, password, displayName }: SignUpCredentials): Promise<UserCredential> => {
    try {
      const authInstance = ensureAuth();
      const result = await createUserWithEmailAndPassword(authInstance, email, password);
      
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      return result;
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async ({ email, password }: AuthCredentials): Promise<UserCredential> => {
    try {
      const authInstance = ensureAuth();
      return await signInWithEmailAndPassword(authInstance, email, password);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async (): Promise<UserCredential> => {
    try {
      const authInstance = ensureAuth();
      return await signInWithPopup(authInstance, googleProvider);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<void> => {
    try {
      const authInstance = ensureAuth();
      await firebaseSignOut(authInstance);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Reset password for email
   */
  resetPassword: async (email: string): Promise<void> => {
    try {
      const authInstance = ensureAuth();
      await sendPasswordResetEmail(authInstance, email);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },
}; 