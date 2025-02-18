export const protectedPaths = ['/standards-graph', '/standards-graph/*'];
export const authPaths = ['/sign-in', '/sign-up'];

export const handleProtectedRoute = () => {
  // We'll handle auth client-side since we can't access Firebase Auth in middleware
  return null;
};

export const handleAuthRoute = () => {
  // We'll handle auth client-side since we can't access Firebase Auth in middleware
  return null;
}; 