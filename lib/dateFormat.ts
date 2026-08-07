// Every timestamp from the backend is stored and transmitted in UTC; this
// admin panel is used exclusively by an India-based team, so every render
// here pins the display timezone to IST regardless of where the
// server/browser doing the rendering happens to be. Vercel's Node runtime
// defaults to UTC, which is what made unlabeled server-rendered
// `new Date(x).toLocaleString()` calls silently wrong by 5:30 before this.
const IST_TIMEZONE = 'Asia/Kolkata';

export function formatDateIST(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(undefined, { timeZone: IST_TIMEZONE });
}

export function formatDateTimeIST(value: string | number | Date): string {
  return new Date(value).toLocaleString(undefined, { timeZone: IST_TIMEZONE });
}
