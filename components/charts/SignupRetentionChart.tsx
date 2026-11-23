'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SignupChartRow } from '@/lib/signupRetention';

// D1/D3/D7 are the same unit (percent of eligible signups), so one grouped
// bar chart. A null value (day not yet measurable) draws no bar, never 0%.
export function SignupRetentionChart({ rows }: { rows: SignupChartRow[] }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No signups in this window.</div>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [value == null ? 'not yet measurable' : `${value}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="d1" name="D1" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="d3" name="D3" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="d7" name="D7" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
