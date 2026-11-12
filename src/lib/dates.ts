/**
 * Calendar dates as "YYYY-MM-DD" strings. Arithmetic runs on UTC day numbers,
 * so daylight saving time never shifts a day.
 */

const DAY_MS = 86_400_000;

export function toDayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days);
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Monday of the week that contains the date (weeks start on Monday). */
export function weekStart(date: string): string {
  const day = toDayNumber(date);
  // 1970-01-01 was a Thursday: (day + 3) % 7 is 0 on Mondays.
  return fromDayNumber(day - ((day + 3) % 7));
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(date: string): number {
  return (toDayNumber(date) + 3) % 7;
}

/** Today's date in the given IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** ISO 8601 week number. */
export function isoWeek(date: string): number {
  const thursday = toDayNumber(weekStart(date)) + 3;
  const yearStart = Date.UTC(new Date(thursday * DAY_MS).getUTCFullYear(), 0, 1) / DAY_MS;
  return Math.floor((thursday - yearStart) / 7) + 1;
}

/** First day of the month after the given date. */
export function nextMonthStart(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
