import Link from 'next/link';
import { Card } from '@/components/ui/Card';

const SECTIONS = [
  { href: '/settings/launch-maintenance', title: 'Launch & maintenance', description: 'Launch gate and website maintenance windows.' },
  { href: '/settings/policy-billing', title: 'Policy & billing', description: 'Cancellation policy, wallet top-up presets, and profile-completion bonus.' },
  { href: '/settings/flags-social', title: 'Flags & social', description: 'Feature flags and the platform-wide social switch.' },
  { href: '/settings/otp-auth', title: 'OTP & auth', description: 'OTP provider and skip allowlist for login verification.' },
  { href: '/settings/app-versions', title: 'App versions', description: 'Force-update and soft-update configuration for customer and partner apps.' },
] as const;

export function SettingsSectionNav() {
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
            <div className="text-sm font-medium">{s.title}</div>
            <div className="mt-1 text-sm text-gray-500">{s.description}</div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
