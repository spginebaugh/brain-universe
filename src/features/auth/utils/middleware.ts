import { NextRequest } from 'next/server';

export const protectedPaths = ['/graph-workspace', '/graph-workspace/*', '/research', '/research/*'];
export const authPaths = ['/sign-in', '/sign-up'];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleProtectedRoute = (_request: NextRequest) => {
  // We'll handle auth client-side since we can't access Firebase Auth in middleware
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleAuthRoute = (_request: NextRequest) => {
  // We'll handle auth client-side since we can't access Firebase Auth in middleware
  return null;
}; 