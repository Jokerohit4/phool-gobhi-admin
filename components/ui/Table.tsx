import type { ReactNode } from 'react';

export function Table({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-800">
      <table className={`w-full text-left text-sm ${className}`.trim()}>{children}</table>
    </div>
  );
}

export function Thead({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800/50">
      <tr className={`border-b dark:border-gray-800 ${className}`.trim()}>{children}</tr>
    </thead>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-300 ${className}`.trim()}>{children}</th>;
}

export function Td({
  children,
  colSpan,
  className = '',
  title,
}: {
  children: ReactNode;
  colSpan?: number;
  className?: string;
  title?: string;
}) {
  return (
    <td className={`px-3 py-2 align-top ${className}`.trim()} colSpan={colSpan} title={title}>
      {children}
    </td>
  );
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b last:border-0 dark:border-gray-800 ${className}`.trim()}>{children}</tr>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <Tr>
      <Td colSpan={colSpan}>
        <span className="text-gray-500">{children}</span>
      </Td>
    </Tr>
  );
}
