import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

type Status = 'default' | 'warning' | 'critical';

const STATUS_VALUE_CLASSES: Record<Status, string> = {
  default: '',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
};

// One consistent stat-tile shape used across every analytics view, replacing
// the ad-hoc `<div className="text-sm text-gray-500">...` pairs each view
// used to write out by hand. `status` encodes severity in form, not just
// number — a warning tile reads as one at a glance, not just on close reading.
export function StatTile({
  label,
  value,
  status = 'default',
  hint,
}: {
  label: string;
  value: ReactNode;
  status?: Status;
  hint?: string;
}) {
  return (
    <Card>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${STATUS_VALUE_CLASSES[status]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </Card>
  );
}
