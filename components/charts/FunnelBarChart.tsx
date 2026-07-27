'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface FunnelStep {
  label: string;
  value: number;
}

// Ordered-magnitude data (funnel steps), not identity — one hue throughout,
// not one color per bar. Matches the admin portal's existing emerald accent
// (Sidebar's active nav state, Attendance page's period toggle). One mid-tone
// value legible on both the light and dark surface, rather than a per-theme
// swap — simple is right for a single-series internal chart.
const BAR_FILL = '#10b981'; // emerald-500

function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FunnelStep }[];
}) {
  if (!active || !payload?.length) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="rounded border bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums text-gray-600 dark:text-gray-300">{value.toLocaleString()} users</div>
    </div>
  );
}

export function FunnelBarChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No data in this window yet.</div>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ className: 'stroke-gray-300 dark:stroke-gray-700' }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
          <Bar dataKey="value" fill={BAR_FILL} radius={[4, 4, 0, 0]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
