import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SettingsSectionNav } from './SettingsSectionNav';

export default async function SettingsPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <PageHeader
        title="Settings"
        subtitle="Launch controls, policies, feature flags, auth, billing presets, and app configuration. Choose a section below."
      />
      <SettingsSectionNav />
    </div>
  );
}
