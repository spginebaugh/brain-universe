import { AuthLayout } from '@/features/auth';

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
} 