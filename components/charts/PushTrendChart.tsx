'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface PushTrendPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
}

const SERIES = [
  { key: 'sent', label: 'Sent', color: '#6b7280' },
  { key: 'delivered', label: 'Delivered', color: '#0ea5e9' },
  { key: 'opened', label: 'Opened', color: '#059669' },
] as const;

function shortDate(d: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[2]}-${m[1]}` : d;
}

// Three series share one count axis (same unit), so one chart is fine here.
export function PushTrendChart({ points }: { points: PushTrendPoint[] }) {
  if (points.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No pushes in this window yet.</div>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            labelFormatter={(l) => String(l)}
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [Number(value).toLocaleString(), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
