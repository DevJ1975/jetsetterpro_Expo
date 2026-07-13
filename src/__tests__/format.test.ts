import {
  formatDateRange,
  formatMoney,
  makeId,
  parseDate,
  relativeDayLabel,
  toISODate,
} from '@/src/core/format';
import { isoDaysFrom } from './_fixtures';

describe('toISODate', () => {
  it('formats a local Date as YYYY-MM-DD with zero padding', () => {
    // Constructed via local ctor so the calendar day is TZ-independent.
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('parseDate', () => {
  it('parses a date-only string as local midnight (not UTC)', () => {
    const d = parseDate('2026-06-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('round-trips with toISODate for the same calendar day', () => {
    expect(toISODate(parseDate('2026-03-14'))).toBe('2026-03-14');
  });

  it('parses a full ISO datetime', () => {
    const d = parseDate('2026-06-09T13:30:00.000Z');
    expect(d.getTime()).toBe(Date.parse('2026-06-09T13:30:00.000Z'));
  });
});

describe('formatDateRange', () => {
  it('includes both day numbers and an en-dash', () => {
    const out = formatDateRange('2026-06-09', '2026-06-12');
    expect(out).toContain('9');
    expect(out).toContain('12');
    expect(out).toContain('–');
  });

  it('handles a cross-month range', () => {
    const out = formatDateRange('2026-06-28', '2026-07-02');
    expect(out).toContain('28');
    expect(out).toContain('2');
    expect(out).toContain('–');
  });
});

describe('formatMoney', () => {
  it('formats a USD amount with the amount digits present', () => {
    expect(formatMoney(1234.5, 'USD')).toContain('1,234.5');
  });

  it('falls back to `CODE amount` for a structurally invalid currency code', () => {
    // Intl only rejects malformed codes (not 3 ASCII letters); a 2-letter code
    // makes it throw, so the catch branch runs with a plain-space fallback.
    expect(formatMoney(5, 'XX')).toBe('XX 5.00');
  });

  it('still formats a well-formed but unknown 3-letter code via Intl', () => {
    // 'ZZZ' is well-formed, so Intl formats it (does NOT hit the fallback).
    const out = formatMoney(5, 'ZZZ');
    expect(out).toContain('ZZZ');
    expect(out).toContain('5');
  });
});

describe('relativeDayLabel', () => {
  it('labels today, tomorrow and yesterday', () => {
    expect(relativeDayLabel(isoDaysFrom(0))).toBe('Today');
    expect(relativeDayLabel(isoDaysFrom(1))).toBe('Tomorrow');
    expect(relativeDayLabel(isoDaysFrom(-1))).toBe('Yesterday');
  });

  it('labels near-future days in days', () => {
    expect(relativeDayLabel(isoDaysFrom(3))).toBe('In 3 days');
    expect(relativeDayLabel(isoDaysFrom(13))).toBe('In 13 days');
  });

  it('labels two-weeks-plus in weeks', () => {
    expect(relativeDayLabel(isoDaysFrom(14))).toBe('In 2 weeks');
    expect(relativeDayLabel(isoDaysFrom(21))).toBe('In 3 weeks');
  });

  it('falls back to a calendar date for far-past days', () => {
    // -3 days is not Today/Tomorrow/Yesterday and not in the future → date string.
    const out = relativeDayLabel(isoDaysFrom(-3));
    expect(out).not.toMatch(/Today|Tomorrow|Yesterday|In /);
  });
});

describe('makeId', () => {
  it('produces a v4-shaped UUID', () => {
    expect(makeId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('produces distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeId()));
    expect(ids.size).toBe(200);
  });
});
