import type { Unit } from './model';

const LOCALE = 'de-CH';

const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

/** Dates are "YYYY-MM-DD"; formatting them at UTC midnight keeps the calendar day. */
function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function dateFormat(options: Intl.DateTimeFormatOptions): (date: string) => string {
  const f = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...options });
  return (date) => f.format(utc(date));
}

export const formatDayMonth = dateFormat({ day: 'numeric', month: 'short' });
export const formatLongDate = dateFormat({ weekday: 'long', day: 'numeric', month: 'long' });
export const formatMonth = dateFormat({ month: 'long' });
export const formatMonthShort = dateFormat({ month: 'short' });
export const formatFullDate = dateFormat({ day: 'numeric', month: 'numeric', year: 'numeric' });

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatWhole(value: number): string {
  return whole.format(value);
}

export function formatCompact(value: number): string {
  return value < 10_000 ? whole.format(value) : compact.format(value);
}

const UNIT_LABEL: Record<Unit, string> = { kg: 'kg', s: 's', reps: 'Wdh.' };

export function unitLabel(unit: Unit): string {
  return UNIT_LABEL[unit];
}

export function formatValue(value: number, unit: Unit): string {
  return `${formatNumber(value)} ${UNIT_LABEL[unit]}`;
}

export function formatChange(change: number, unit: Unit): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(change))} ${UNIT_LABEL[unit]}`;
}

export function formatTimestamp(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function plural(count: number, one: string, many: string): string {
  return `${formatWhole(count)} ${count === 1 ? one : many}`;
}
