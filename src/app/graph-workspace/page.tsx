'use client';

import { ProtectedRoute } from '@/features/auth';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { GraphWorkspace } from '@/features/graph-workspace/components/graph-workspace';

export default function GraphWorkspacePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {user && <GraphWorkspace userId={user.uid} />}
      </main>
    </ProtectedRoute>
  );
} 