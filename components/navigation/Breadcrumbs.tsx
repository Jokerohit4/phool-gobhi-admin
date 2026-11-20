'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/app/sidebar';

export type BreadcrumbItem = { label: string; href?: string };

function titleize(segment: string) {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

const SPECIAL_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/analytics': 'Analytics',
  '/gyms': 'Gyms',
  '/unclaimed-gyms': 'Unclaimed gyms',
  '/edit-requests': 'Edit Requests',
  '/attendance-saas': 'Attendance SaaS',
  '/fulfillment': 'Coaching fulfillment',
  '/coaching-plans': 'Guided plans & offerings',
  '/reports': 'Blood reports',
  '/users': 'Users & cohorts',
  '/food-requests': 'Food Queue',
  '/notifications': 'Push campaigns',
  '/pitch-access': 'Pitch Access',
  '/buddy-reports': 'Buddy reports',
  '/gamification/coins': 'Coins & Streaks',
  '/gamification/challenges': 'Challenges',
  '/admin/fulfillment': 'Coaching fulfillment',
};

function labelFor(href: string) {
  if (SPECIAL_LABELS[href]) return SPECIAL_LABELS[href];
  const nav = NAV_ITEMS.find((item) => item.href === href);
  if (nav) return nav.label;
  const segments = href.split('/').filter(Boolean);
  return segments.length ? titleize(segments[segments.length - 1]) : 'Dashboard';
}

export function Breadcrumbs({ items }: { items?: BreadcrumbItem[] } = {}) {
  const pathname = usePathname();
  if (!pathname || pathname === '/login') return null;

  const crumbs: { href?: string; label: string }[] = items?.length
    ? [{ href: '/', label: 'Dashboard' }, ...items]
    : (() => {
        const segments = pathname.split('/').filter(Boolean);
        const auto = [{ href: '/', label: 'Dashboard' }];
        let acc = '';
        for (const segment of segments) {
          acc += `/${segment}`;
          auto.push({ href: acc, label: labelFor(acc) });
        }
        return auto;
      })();

  const deduped = crumbs.filter((c, i, arr) => !(i > 0 && c.href && c.href === arr[i - 1].href));

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {deduped.map((crumb, idx) => {
          const isLast = idx === deduped.length - 1;
          return (
            <li key={`${crumb.href ?? 'crumb'}-${crumb.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <span aria-hidden="true">/</span>}
              {isLast || !crumb.href ? (
                <span className="font-medium text-gray-700 dark:text-gray-200" aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-gray-900 hover:underline dark:hover:text-gray-100">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
