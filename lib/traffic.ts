export const TRAFFIC_PRODUCTS = { all: 'All', customer: 'Customer app', partner: 'Partner app', website: 'Website' } as const;
export type TrafficProduct = keyof typeof TRAFFIC_PRODUCTS;
export type TrafficPlatform = 'both' | 'android' | 'ios';

export function trafficSelection(product?: string, platform?: string): { product: TrafficProduct; platform: TrafficPlatform } {
  const selected: TrafficProduct = product && Object.hasOwn(TRAFFIC_PRODUCTS, product) ? product as TrafficProduct : 'all';
  return { product: selected, platform: (selected === 'customer' || selected === 'partner') && (platform === 'android' || platform === 'ios') ? platform : 'both' };
}

export interface TrafficRow {
  kind: string;
  label: string;
  app: string;
  platform: string;
  n: number;
  users: number;
  views: number;
  sessions: number;
  seconds: number;
  measured: number;
}

/** One person in a weekday/hour heatmap cell. `name` is null for anonymous visitors. */
export interface HeatmapUser {
  app: string;
  id: string;
  name: string | null;
  events: number;
  activity: { label: string; n: number }[];
}

export interface TrafficReport {
  asOf: string;
  filters: { product: TrafficProduct; platform: TrafficPlatform; days: number; cohort?: string };
  timezone: string;
  activeUsers: { dau: number; wau: number; mau: number };
  summary: TrafficRow & { sessionEvents: number; averageSecondsPerSession: number | null; averageSecondsPerUser: number | null };
  daily: TrafficRow[];
  screens: TrafficRow[];
  actions: TrafficRow[];
  heatmap: TrafficRow[];
  /** Keyed `${weekday 0=Mon}-${hour}`; absent on older backends. */
  heatmapUsers?: Record<string, HeatmapUser[]>;
  breakdown: TrafficRow[];
  frequency: TrafficRow[];
  sessionLengths: TrafficRow[];
}

export function engagementDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const value = Math.round(seconds);
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`;
  return `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m`;
}

// Events are aggregated in IST; include empty dates so charts cannot bridge
// inactive days and imply continuous activity. Rolling windows can span N+1 dates.
export function dailyTrafficPoints(report: TrafficReport, metric: 'users' | 'views' | 'n') {
  const offset = 330 * 60000;
  const end = new Date(report.asOf).getTime();
  const first = new Date(end - report.filters.days * 86400000 + offset).toISOString().slice(0, 10);
  const last = new Date(end - 1 + offset).toISOString().slice(0, 10);
  const values = new Map(report.daily.map(row => [row.label, row[metric]]));
  const points = [];
  for (let day = Date.parse(`${first}T00:00:00Z`); day <= Date.parse(`${last}T00:00:00Z`); day += 86400000) {
    const label = new Date(day).toISOString().slice(0, 10);
    points.push({ day: label, value: values.get(label) || 0 });
  }
  return points;
}
