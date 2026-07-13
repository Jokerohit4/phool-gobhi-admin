import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-800">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800/50">
      <tr className="border-b dark:border-gray-800">{children}</tr>
    </thead>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300">{children}</th>;
}

export function Td({
  children,
  colSpan,
  className = '',
}: {
  children: ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-top ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b last:border-0 dark:border-gray-800">{children}</tr>;
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
