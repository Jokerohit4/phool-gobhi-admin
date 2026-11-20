export const campaignApi = '/api/notifications/admin';

export type CampaignConfig = {
  name: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  deepLink: string;
  audience: { type: 'all' | 'cohorts' | 'users'; cohorts?: string[]; userIds?: number[] };
  mode: 'once' | 'recurring' | 'event';
  startAt: string | null;
  endAt: string | null;
  intervalMinutes?: number;
  maxRuns?: number;
  event?: string;
  delayMinutes?: number;
  cooldownMinutes?: number;
  maxPerUser?: number;
};

export type Campaign = {
  id: string;
  config: CampaignConfig;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  next_at: string | null;
  run_count: number;
};

export type CampaignOptions = {
  destinations: { path: string; label: string; parameter?: string }[];
  events: Record<string, string>;
  cohorts: string[];
};

export type Run = {
  id: string;
  kind: 'scheduled' | 'event' | 'test';
  due_at: string;
  expanded: boolean;
  counts: Record<string, number>;
};

export function asIndiaInput(value: string | null | undefined) {
  return value ? new Date(Date.parse(value) + 330 * 60_000).toISOString().slice(0, 16) : '';
}

export function displayTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value)) + ' IST';
}
