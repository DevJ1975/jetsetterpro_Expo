import type { ISODate, ISODateTime } from '@/src/types/models';

/** 'YYYY-MM-DD' for a Date (local calendar day). */
export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(iso: ISODate | ISODateTime): Date {
  // Date-only strings are parsed as UTC midnight by JS; append time to keep them
  // on the intended calendar day in the local zone.
  return iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

export function formatDate(
  iso: ISODate | ISODateTime,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(parseDate(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: ISODateTime): string {
  return formatDate(iso, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateRange(start: ISODate, end: ISODate): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startStr = formatDate(start, { month: 'short', day: 'numeric' });
  const endStr = formatDate(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Minutes → compact '2h 15m' / '45m' / '3h'. Negative clamps to 0. */
export function formatDuration(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Kilometres → '1,240 km' or '770 mi', honoring the unit; ≥100 rounds to
 *  whole, below keeps one decimal. Grouping is locale-aware. */
export function formatDistance(km: number, unit: 'mi' | 'km' = 'km'): string {
  const value = unit === 'mi' ? km * 0.621371 : km;
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString()} ${unit}`;
}

/** 'Today', 'Tomorrow', 'In 3 days', 'In 2 weeks', or a date for far-out dates. */
export function relativeDayLabel(iso: ISODate | ISODateTime): string {
  const target = parseDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 14) return `In ${days} days`;
  if (days >= 14) return `In ${Math.round(days / 7)} weeks`;
  return formatDate(iso, { month: 'short', day: 'numeric' });
}

/** Lightweight RFC4122-ish id (no native crypto dependency needed for PR #1). */
export function makeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
