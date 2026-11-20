'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from '@/app/sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login' || pathname?.startsWith('/login/');

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
