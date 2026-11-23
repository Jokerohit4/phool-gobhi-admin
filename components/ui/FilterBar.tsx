import type { ReactNode } from 'react';

export function FilterBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-end gap-3 rounded border bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/40 ${className}`.trim()}>{children}</div>;
}
