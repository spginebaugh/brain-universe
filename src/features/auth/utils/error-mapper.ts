import { FirebaseError } from '@firebase/app';
import { AUTH_ERROR_CODE, AuthError } from '../types/errors';

const FIREBASE_TO_AUTH_ERROR_MAP: Record<string, typeof AUTH_ERROR_CODE[keyof typeof AUTH_ERROR_CODE]> = {
  'auth/invalid-email': AUTH_ERROR_CODE.INVALID_EMAIL,
  'auth/user-disabled': AUTH_ERROR_CODE.USER_DISABLED,
  'auth/user-not-found': AUTH_ERROR_CODE.USER_NOT_FOUND,
  'auth/wrong-password': AUTH_ERROR_CODE.WRONG_PASSWORD,
  'auth/email-already-in-use': AUTH_ERROR_CODE.EMAIL_EXISTS,
  'auth/operation-not-allowed': AUTH_ERROR_CODE.OPERATION_NOT_ALLOWED,
  'auth/weak-password': AUTH_ERROR_CODE.WEAK_PASSWORD,
  'auth/network-request-failed': AUTH_ERROR_CODE.NETWORK_ERROR,
  'auth/internal-error': AUTH_ERROR_CODE.INTERNAL_ERROR,
};

const ERROR_MESSAGES: Record<typeof AUTH_ERROR_CODE[keyof typeof AUTH_ERROR_CODE], string> = {
  [AUTH_ERROR_CODE.INVALID_EMAIL]: 'The email address is invalid.',
  [AUTH_ERROR_CODE.USER_DISABLED]: 'This account has been disabled.',
  [AUTH_ERROR_CODE.USER_NOT_FOUND]: 'No account found with this email.',
  [AUTH_ERROR_CODE.WRONG_PASSWORD]: 'Incorrect password.',
  [AUTH_ERROR_CODE.EMAIL_EXISTS]: 'An account with this email already exists.',
  [AUTH_ERROR_CODE.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',
  [AUTH_ERROR_CODE.WEAK_PASSWORD]: 'The password is too weak.',
  [AUTH_ERROR_CODE.NETWORK_ERROR]: 'A network error occurred. Please check your connection.',
  [AUTH_ERROR_CODE.INTERNAL_ERROR]: 'An internal error occurred.',
  [AUTH_ERROR_CODE.UNKNOWN_ERROR]: 'An unknown error occurred.',
};

export const mapFirebaseError = (error: unknown): AuthError => {
  if (error instanceof FirebaseError && error.code) {
    const code = FIREBASE_TO_AUTH_ERROR_MAP[error.code] || AUTH_ERROR_CODE.UNKNOWN_ERROR;
    return {
      code,
      message: ERROR_MESSAGES[code],
      originalError: error,
    };
  }

  return {
    code: AUTH_ERROR_CODE.UNKNOWN_ERROR,
    message: ERROR_MESSAGES[AUTH_ERROR_CODE.UNKNOWN_ERROR],
    originalError: error instanceof Error ? error : undefined,
  };
}; 