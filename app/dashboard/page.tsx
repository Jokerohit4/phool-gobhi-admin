import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

const QUICK_LINKS = [
  { href: '/analytics', title: 'Analytics', desc: 'Funnels, traffic, revenue and cohort metrics.' },
  { href: '/gyms', title: 'Gyms', desc: 'Approve, review and manage gym listings.' },
  { href: '/users', title: 'Users & cohorts', desc: 'Customer accounts, cohorts and account state.' },
  { href: '/fulfillment', title: 'Coaching fulfillment', desc: 'Memberships, sessions, clinical review and care requests.' },
  { href: '/payouts', title: 'Payouts', desc: 'Partner balances and payout operations.' },
  { href: '/messages', title: 'Messages', desc: 'Contact and inbound operational messages.' },
  { href: '/food-requests', title: 'Food Queue', desc: 'Food request and review workflow.' },
  { href: '/settings', title: 'Settings', desc: 'Launch, policy, flags, auth and app configuration.' },
];

export default async function DashboardPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview and shortcuts to the areas you manage most often."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="h-full transition-colors group-hover:border-emerald-300 dark:group-hover:border-emerald-700">
              <div className="mb-1 text-base font-semibold text-gray-900 group-hover:text-emerald-700 dark:text-gray-100 dark:group-hover:text-emerald-400">
                {item.title}
              </div>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
