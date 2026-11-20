'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type NavItem = { href: string; label: string; icon?: string; badgeKey?: string };
export type NavGroup = { id: string; label: string; icon?: string; items: NavItem[] };

const Icon = ({ name, className = 'h-4 w-4' }: { name?: string; className?: string }) => {
  const p = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'home': return <svg {...p}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case 'building': return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></svg>;
    case 'chart': return <svg {...p}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/></svg>;
    case 'users': return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'wallet': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/></svg>;
    case 'message': return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'heart': return <svg {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>;
    case 'star': return <svg {...p}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>;
    case 'doc': return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>;
    case 'briefcase': return <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'shield': return <svg {...p}><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z"/></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6z"/></svg>;
    case 'check': return <svg {...p}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'bolt': return <svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="3"/></svg>;
  }
};

export const NAV_GROUPS: NavGroup[] = [
  { id: 'overview', label: 'Overview', icon: 'chart', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'home' },
    { href: '/analytics', label: 'Analytics', icon: 'chart' },
  ]},
  { id: 'supply', label: 'Gyms & Supply', icon: 'building', items: [
    { href: '/gyms', label: 'Gyms', icon: 'building', badgeKey: 'gyms' },
    { href: '/unclaimed-gyms', label: 'Unclaimed gyms', icon: 'building', badgeKey: 'unclaimed-gyms' },
    { href: '/edit-requests', label: 'Edit Requests', icon: 'doc', badgeKey: 'edit-requests' },
  ]},
  { id: 'operations', label: 'Operations', icon: 'check', items: [
    { href: '/attendance', label: 'Attendance', icon: 'check' },
    { href: '/live', label: 'Live Tracking', icon: 'bolt' },
    { href: '/attendance-saas', label: 'Attendance SaaS', icon: 'check' },
    { href: '/fulfillment', label: 'Coaching fulfillment', icon: 'check', badgeKey: 'fulfillment' },
  ]},
  { id: 'users', label: 'Users & Engagement', icon: 'users', items: [
    { href: '/users', label: 'Users & cohorts', icon: 'users' },
    { href: '/reviews', label: 'Reviews', icon: 'star', badgeKey: 'reviews' },
    { href: '/buddy-reports', label: 'Buddy reports', icon: 'shield', badgeKey: 'buddy-reports' },
    { href: '/health', label: 'Health & Training', icon: 'heart' },
    { href: '/food-requests', label: 'Food Queue', icon: 'doc', badgeKey: 'food-requests' },
  ]},
  { id: 'gamification', label: 'Gamification', icon: 'star', items: [
    { href: '/gamification/coins', label: 'Coins & Streaks', icon: 'star' },
    { href: '/gamification/challenges', label: 'Challenges', icon: 'star' },
  ]},
  { id: 'content', label: 'Content & Growth', icon: 'message', items: [
    { href: '/content', label: 'Content', icon: 'doc' },
    { href: '/jobs', label: 'Jobs', icon: 'briefcase' },
    { href: '/applications', label: 'Applications', icon: 'doc', badgeKey: 'applications' },
    { href: '/messages', label: 'Messages', icon: 'message', badgeKey: 'messages' },
    { href: '/pitch-access', label: 'Pitch Access', icon: 'doc' },
  ]},
  { id: 'finance', label: 'Finance & Staff', icon: 'wallet', items: [
    { href: '/payouts', label: 'Payouts', icon: 'wallet', badgeKey: 'payouts' },
    { href: '/staff', label: 'Staff', icon: 'users' },
  ]},
  { id: 'system', label: 'System', icon: 'settings', items: [
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ]},
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar({ badges }: { badges?: Record<string, number> } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_nav_open');
      if (raw) setOpen(JSON.parse(raw));
    } catch {}
  }, []);

  const activeGroups = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) map[g.id] = g.items.some((i) => isActive(pathname, i.href));
    return map;
  }, [pathname]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      try { localStorage.setItem('admin_nav_open', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
      <div className="border-b border-gray-200 px-4 py-4 font-semibold dark:border-gray-800">
        <Link href="/dashboard" className="hover:underline">Phool Gobhi Admin</Link>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
        {NAV_GROUPS.map((group) => {
          const expanded = open[group.id] ?? true;
          const groupActive = activeGroups[group.id];
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggle(group.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide ${
                  groupActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                } hover:bg-gray-100 dark:hover:bg-gray-800`}
                aria-expanded={expanded}
              >
                <span className="flex items-center gap-2"><Icon name={group.icon} />{group.label}</span>
                <span aria-hidden="true" className="text-[10px]">{expanded ? '▾' : '▸'}</span>
              </button>
              {expanded && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const count = item.badgeKey ? badges?.[item.badgeKey] : undefined;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-sm ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2"><Icon name={item.icon} /><span className="truncate">{item.label}</span></span>
                        {typeof count === 'number' && count > 0 && (
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                            {count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="mx-2 mb-4 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Logout
      </button>
    </aside>
  );
}
