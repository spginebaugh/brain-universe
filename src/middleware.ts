import { NextResponse } from 'next/server';

export function middleware() {
  // We'll handle auth client-side since we can't use Firebase in Edge Runtime
  return NextResponse.next();
}

export const config = {
  matcher: []
}; 