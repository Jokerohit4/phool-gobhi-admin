import type { ReactNode } from 'react';

export function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded border border-dashed p-6 text-sm text-gray-500 dark:border-gray-700 ${className}`.trim()}>{children}</div>;
}
