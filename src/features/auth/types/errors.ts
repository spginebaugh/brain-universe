// Auth status as a const for better type safety
export const AUTH_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type AuthStatus = typeof AUTH_STATUS[keyof typeof AUTH_STATUS];

// Specific error codes for better error handling
export const AUTH_ERROR_CODE = {
  INVALID_EMAIL: 'auth/invalid-email',
  USER_DISABLED: 'auth/user-disabled',
  USER_NOT_FOUND: 'auth/user-not-found',
  WRONG_PASSWORD: 'auth/wrong-password',
  EMAIL_EXISTS: 'auth/email-already-in-use',
  OPERATION_NOT_ALLOWED: 'auth/operation-not-allowed',
  WEAK_PASSWORD: 'auth/weak-password',
  NETWORK_ERROR: 'auth/network-error',
  INTERNAL_ERROR: 'auth/internal-error',
  UNKNOWN_ERROR: 'auth/unknown',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODE[keyof typeof AUTH_ERROR_CODE];

// Specific error type for auth errors
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  originalError?: Error;
} 