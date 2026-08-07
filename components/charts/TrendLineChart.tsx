'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateIST } from '@/lib/dateFormat';

export interface TrendPoint {
  day: string;
  value: number;
}

const LINE_STROKE = '#059669'; // emerald-600, same accent family as FunnelBarChart
const AREA_FILL = 'rgba(16,185,129,0.12)';

function TrendTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  valueFormatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const { day, value } = payload[0].payload;
  return (
    <div className="rounded border bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="font-medium">{formatDateIST(day)}</div>
      <div className="tabular-nums text-gray-600 dark:text-gray-300">{valueFormatter(value)}</div>
    </div>
  );
}

// Single-series only, by design — a second measure of different scale (e.g.
// GMV vs. booking count) gets its own chart, never a second y-axis on this one.
export function TrendLineChart({
  points,
  valueFormatter = (v: number) => v.toLocaleString(),
}: {
  points: TrendPoint[];
  valueFormatter?: (v: number) => string;
}) {
  if (points.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No data in this window yet.</div>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ className: 'stroke-gray-300 dark:stroke-gray-700' }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<TrendTooltip valueFormatter={valueFormatter} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={LINE_STROKE}
            strokeWidth={2}
            fill={AREA_FILL}
            dot={{ r: 3, fill: LINE_STROKE }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
