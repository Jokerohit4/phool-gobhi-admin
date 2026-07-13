import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 dark:bg-gray-900 dark:border-gray-800 ${className}`}
    >
      {children}
    </div>
  );
}
