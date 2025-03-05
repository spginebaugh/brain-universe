'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { SideBar } from '@/features/side-bar/components/side-bar';
import { ShopPanel } from '@/features/shop-panel/components/shop-panel';

interface LayoutContentProps {
  children: ReactNode;
}

export function LayoutContent({ children }: LayoutContentProps) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');

  return (
    <div className="flex">
      {!isAuthPage && <SideBar />}
      {!isAuthPage && <ShopPanel />}
      <main className={`flex-1 ${!isAuthPage ? 'ml-16' : ''}`}>
        {children}
      </main>
    </div>
  );
} 