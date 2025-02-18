import { AuthLayout } from '@/features/auth';

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
} 