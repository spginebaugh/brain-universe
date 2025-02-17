import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { SideBar } from '@/features/side-bar/components/side-bar';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Brain Universe',
  description: 'Explore and learn with interactive knowledge graphs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex">
            <SideBar />
            <main className="flex-1 ml-16">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
