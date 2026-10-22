const DAY_MS = 86_400_000;

/** Today's date in Bangladesh time, as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** Whole days from today until the given ISO date (negative if in the past). */
export function daysUntil(iso: string): number {
  return dayNumber(iso) - dayNumber(todayISO());
}

/** Returns an ISO date offset from today by the given number of days. */
export function addDays(offset: number): string {
  const base = dayNumber(todayISO()) + offset;
  return new Date(base * DAY_MS).toISOString().slice(0, 10);
}
