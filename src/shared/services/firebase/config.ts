import { getApps, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize auth on the client side immediately
export const auth = typeof window !== 'undefined' ? getAuth(firebaseApp) : null;

// Initialize server-safe Firebase services
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Analytics is optional and only available on the client side
export let analytics: ReturnType<typeof getAnalytics> | null = null;

// Initialize client-side Firebase services
export const initializeFirebaseServices = () => {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Initialize analytics if not already initialized
  if (!analytics) {
    analytics = getAnalytics(firebaseApp);
  }
}; 