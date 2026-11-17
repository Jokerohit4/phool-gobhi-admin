// Keep the displayed window aligned with the analytics API's 365-day limit.
export function analyticsDays(value: string | undefined): string {
  const days = Number(value);
  return Number.isInteger(days) && days > 0 && days <= 365 ? String(days) : '30';
}

export function averagePer(total: number, count: number): string {
  return count > 0 ? (total / count).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
}
