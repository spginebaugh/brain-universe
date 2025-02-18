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

export const authService = {
  /**
   * Initialize auth state listener
   * @param onAuthStateChange Callback function to handle auth state changes
   * @returns Unsubscribe function
   */
  initializeAuthListener: (onAuthStateChange: (user: User | null) => void) => {
    return onAuthStateChanged(auth, onAuthStateChange);
  },

  /**
   * Sign up with email and password
   */
  signUp: async ({ email, password, displayName }: SignUpCredentials): Promise<UserCredential> => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
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
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async (): Promise<UserCredential> => {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },

  /**
   * Reset password for email
   */
  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  },
}; 