import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-4 space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Brain Universe</h1>
          <p className="text-muted-foreground">Your Learning Journey Begins Here</p>
        </div>
        {children}
      </div>
    </div>
  );
} 