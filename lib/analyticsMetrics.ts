// "today" means since midnight IST; the API resolves it, so it travels as a word.
export const RANGE_TODAY = 'today';

// Keep the displayed window aligned with the analytics API's 365-day limit.
export function analyticsDays(value: string | undefined): string {
  if (value?.trim().toLowerCase() === RANGE_TODAY) return RANGE_TODAY;
  const days = Number(value);
  return Number.isInteger(days) && days > 0 && days <= 365 ? String(days) : '30';
}

// Text for the selected window. `days` is the normalised analyticsDays() value.
export function rangeButtonLabel(days: string, short = false): string {
  if (days === RANGE_TODAY) return 'Today';
  return short ? `${days}d` : `${days} days`;
}

export function rangeSentence(days: string): string {
  return days === RANGE_TODAY ? 'Today (since midnight IST)' : `Last ${days} days`;
}

export function rangeWindowName(days: string): string {
  return days === RANGE_TODAY ? 'today (since midnight IST)' : `${days}-day`;
}

export function averagePer(total: number, count: number): string {
  return count > 0 ? (total / count).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
}
