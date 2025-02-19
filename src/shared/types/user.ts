import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  preferredName: string;
  profilePicture: string;
  bio: string;
}

export interface UserSettings {
  isStudent: boolean;
}

export interface UserProgress {
  completedNodes: number;
  averageScore: number;
  lastActivity: Timestamp;
  brainBucks: number;
}

export interface UserExtensions {
  [key: string]: unknown;
}

export interface User {
  userId: string;
  email: string;
  name: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  profile: UserProfile;
  settings: UserSettings;
  progress: UserProgress;
  extensions?: UserExtensions;
} 