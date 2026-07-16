// Schengen 90-in-180 rolling-window math (port of the iOS VisaLookupView
// computation). Pure — no store/Date.now reads — so it is unit-testable and
// safe to call from render via useMemo with an injected `now`.

import { matchCountry } from '@/src/core/data/countries';
import { parseDate } from '@/src/core/format';
import type { Trip } from '@/src/types/models';

/** Flat per-visit allowance shared across the whole Schengen area. */
export const SCHENGEN_ALLOWANCE_DAYS = 90;
/** Rolling window the allowance is measured against. */
export const SCHENGEN_WINDOW_DAYS = 180;

/** ISO alpha-2 codes of Schengen members (Ireland deliberately excluded —
 *  it is not part of Schengen despite being in the EU). */
export const SCHENGEN_CODES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO',
  'SK', 'SI', 'ES', 'SE', 'CH',
]);

export function isSchengen(code?: string): boolean {
  return !!code && SCHENGEN_CODES.has(code.toUpperCase());
}

export interface SchengenTally {
  /** Whole days spent in any Schengen country inside the trailing 180-day window. */
  used: number;
  /** Days remaining of the 90-day allowance (never negative). */
  remaining: number;
}

const DAY_MS = 86_400_000;

/** Local-midnight timestamp for a Date. */
function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/**
 * Days spent in Schengen countries within the trailing 180-day window ending
 * `now`, plus the days remaining of the shared 90-day allowance.
 *
 * A trip only counts when its free-text destination resolves via
 * `matchCountry` to a Schengen member — the same conservative matcher the rest
 * of the app uses, so fuzzy destinations are never over-counted. Trips are
 * clamped to the window and to today (future days of an in-progress trip don't
 * count yet); day counts are inclusive, so a same-day trip consumes one day.
 */
export function countSchengenDays(trips: Trip[], now: Date = new Date()): SchengenTally {
  const today = startOfDay(now);
  const windowStart = today - (SCHENGEN_WINDOW_DAYS - 1) * DAY_MS;

  let used = 0;
  for (const trip of trips) {
    const country = matchCountry(trip.destination);
    if (!country || !isSchengen(country.code)) continue;

    const tripStart = startOfDay(parseDate(trip.startDate));
    const tripEnd = startOfDay(parseDate(trip.endDate));
    const overlapStart = Math.max(tripStart, windowStart);
    const overlapEnd = Math.min(tripEnd, today);
    if (overlapStart > overlapEnd) continue;

    used += Math.round((overlapEnd - overlapStart) / DAY_MS) + 1;
  }

  const capped = Math.min(used, SCHENGEN_ALLOWANCE_DAYS);
  return { used, remaining: SCHENGEN_ALLOWANCE_DAYS - capped };
}
