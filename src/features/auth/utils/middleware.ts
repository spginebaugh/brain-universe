import { NextRequest, NextResponse } from 'next/server';

export const protectedPaths = [
  '/dashboard',
  '/standards-graph',
  '/standards-graph/*'  // Protect any subroutes under standards-graph
];
export const authPaths = ['/sign-in', '/sign-up'];

export const handleProtectedRoute = (request: NextRequest) => {
  const authSession = request.cookies.get('__session')?.value;
  
  if (!authSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  
  return null;
};

export const handleAuthRoute = (request: NextRequest) => {
  const authSession = request.cookies.get('__session')?.value;
  
  if (authSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return null;
}; 