import { ProtectedRoute } from '@/features/auth';

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
} 