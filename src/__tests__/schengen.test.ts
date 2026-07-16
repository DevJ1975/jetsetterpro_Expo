import {
  countSchengenDays,
  isSchengen,
  SCHENGEN_ALLOWANCE_DAYS,
} from '@/src/features/essentials/schengen';
import type { Trip } from '@/src/types/models';

const NOW = new Date('2026-07-15T12:00:00');

let seq = 0;
function trip(destination: string, startDate: string, endDate: string): Trip {
  seq += 1;
  return { id: `t${seq}`, name: destination, destination, startDate, endDate, items: [] };
}

describe('isSchengen', () => {
  it('recognises members case-insensitively and rejects non-members', () => {
    expect(isSchengen('FR')).toBe(true);
    expect(isSchengen('nl')).toBe(true);
    expect(isSchengen('GB')).toBe(false); // UK is not Schengen
    expect(isSchengen('IE')).toBe(false); // Ireland is EU but not Schengen
    expect(isSchengen(undefined)).toBe(false);
  });
});

describe('countSchengenDays', () => {
  it('returns the full allowance with no trips', () => {
    expect(countSchengenDays([], NOW)).toEqual({ used: 0, remaining: SCHENGEN_ALLOWANCE_DAYS });
  });

  it('counts inclusive days for a Schengen trip inside the window', () => {
    // Jul 1–10 inclusive = 10 days.
    const tally = countSchengenDays([trip('Paris, France', '2026-07-01', '2026-07-10')], NOW);
    expect(tally.used).toBe(10);
    expect(tally.remaining).toBe(80);
  });

  it('counts a same-day trip as one day', () => {
    const tally = countSchengenDays([trip('Amsterdam, Netherlands', '2026-07-10', '2026-07-10')], NOW);
    expect(tally.used).toBe(1);
  });

  it('ignores non-Schengen and unresolvable destinations', () => {
    const tally = countSchengenDays(
      [
        trip('Tokyo, Japan', '2026-07-01', '2026-07-10'),
        trip('London, United Kingdom', '2026-06-01', '2026-06-20'),
        trip('Narnia', '2026-07-01', '2026-07-05'),
      ],
      NOW,
    );
    expect(tally).toEqual({ used: 0, remaining: SCHENGEN_ALLOWANCE_DAYS });
  });

  it('sums days across multiple Schengen trips', () => {
    const tally = countSchengenDays(
      [
        trip('Berlin, Germany', '2026-05-01', '2026-05-07'), // 7 days
        trip('Rome, Italy', '2026-06-10', '2026-06-14'), // 5 days
      ],
      NOW,
    );
    expect(tally.used).toBe(12);
    expect(tally.remaining).toBe(78);
  });

  it('clamps trips that straddle the start of the 180-day window', () => {
    // Window is the trailing 180 days ending 2026-07-15 → starts 2026-01-17.
    // Trip Jan 10 – Jan 20: only Jan 17–20 fall inside = 4 days.
    const tally = countSchengenDays([trip('Madrid, Spain', '2026-01-10', '2026-01-20')], NOW);
    expect(tally.used).toBe(4);
  });

  it('excludes trips entirely before the window', () => {
    const tally = countSchengenDays([trip('Paris, France', '2025-11-01', '2025-11-20')], NOW);
    expect(tally.used).toBe(0);
  });

  it('only counts elapsed days of an in-progress trip (not future days)', () => {
    // Jul 10 – Jul 25, today is Jul 15 → Jul 10–15 inclusive = 6 days.
    const tally = countSchengenDays([trip('Paris, France', '2026-07-10', '2026-07-25')], NOW);
    expect(tally.used).toBe(6);
  });

  it('never reports negative remaining days when over the allowance', () => {
    const tally = countSchengenDays([trip('France', '2026-01-20', '2026-07-14')], NOW);
    expect(tally.used).toBeGreaterThan(SCHENGEN_ALLOWANCE_DAYS);
    expect(tally.remaining).toBe(0);
  });
});
