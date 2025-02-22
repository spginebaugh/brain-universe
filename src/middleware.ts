import { NextRequest, NextResponse } from 'next/server';
import {
  protectedPaths,
  authPaths,
  handleProtectedRoute,
  handleAuthRoute,
} from '@/features/auth';

export const runtime = 'experimental-edge';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is protected
  if (protectedPaths.some(path => pathname.startsWith(path))) {
    const response = handleProtectedRoute(request);
    if (response) return response;
  }

  // Check if the path is an auth path (sign-in, sign-up)
  if (authPaths.includes(pathname)) {
    const response = handleAuthRoute(request);
    if (response) return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/graph-workspace', '/graph-workspace/:path*', '/sign-in', '/sign-up']
}; 