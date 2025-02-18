import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { SideBar } from '@/features/side-bar/components/side-bar';
import { ShopPanel } from '@/features/shop-panel/components/shop-panel';
import { Providers } from './providers';
import { AuthProvider } from '@/features/auth/providers/auth-provider';

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
            <div className="flex">
              <SideBar />
              <ShopPanel />
              <main className="flex-1 ml-16">
                {children}
              </main>
            </div>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
