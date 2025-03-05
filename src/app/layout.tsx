import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { Providers } from './providers';
import { AuthProvider } from '@/features/auth/providers/auth-provider';
import { LayoutContent } from '@/shared/components/layout-content';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Brain Universe',
  description: 'Your learning journey starts here',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Providers>
            <LayoutContent>{children}</LayoutContent>
            <Toaster position="top-right" />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
