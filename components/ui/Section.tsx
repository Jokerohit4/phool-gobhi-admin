import type { ReactNode } from 'react';

export function Section({ title, subtitle, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-4 ${className}`.trim()}>
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
