'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/gyms', label: 'Gyms' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/staff', label: 'Staff' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/messages', label: 'Messages' },
  { href: '/pitch-access', label: 'Pitch Access' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
      <div className="px-4 py-4 font-semibold">Phool Gobhi Admin</div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
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
