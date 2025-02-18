import { ProtectedRoute } from '@/features/auth/components/protected-route';

export default function StandardsGraphLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
} 