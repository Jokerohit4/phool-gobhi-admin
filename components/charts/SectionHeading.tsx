import type { ReactNode } from 'react';

// A card-level heading, one visual step down from the page-level PageHeader
// (text-xl) — /analytics reused PageHeader for every card's inner title too,
// which gave "Analytics" and "Onboarding → approval funnel" identical visual
// weight. This is scoped to the analytics page only; PageHeader itself is
// shared by other admin pages and stays untouched.
export function SectionHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
