// Pure-function tests for the itinerary import parsers — no React Native
// imports. Covers the BCBP (IATA boarding-pass barcode) parser, julian-date
// conversion, and the pasted-confirmation-text extractor.

import { julianToISODate, parseBcbp } from '@/src/features/itinerary/bcbp';
import { parseConfirmationText } from '@/src/features/itinerary/confirmationParser';

// ── BCBP ─────────────────────────────────────────────────────────────────────

/** Realistic single-leg BCBP mandatory section, built field-by-field so the
 *  fixed offsets (IATA Res. 792) are visible: AC 834 YUL → FRA, seat 1A. */
const BCBP_SAMPLE =
  'M1' + // format code + leg count
  'DESMARAIS/LUC       ' + // passenger name (20)
  'E' + // e-ticket indicator
  'ABC123 ' + // PNR (7)
  'YUL' + // origin (3)
  'FRA' + // destination (3)
  'AC ' + // carrier (3)
  '0834 ' + // flight number (5)
  '326' + // julian date (3)
  'J' + // cabin (1)
  '001A' + // seat (4)
  '0025 ' + // check-in sequence (5)
  '1' + // passenger status (1)
  '00'; // conditional-section size (2)

describe('parseBcbp', () => {
  it('parses the mandatory fields of a single-leg M1 payload', () => {
    expect(parseBcbp(BCBP_SAMPLE)).toEqual({
      passengerName: 'Luc Desmarais',
      pnr: 'ABC123',
      origin: 'YUL',
      dest: 'FRA',
      carrier: 'AC',
      flightNumber: '834',
      julianDate: 326,
      seat: '1A',
    });
  });

  it('tolerates a trailing newline from the scanner', () => {
    expect(parseBcbp(BCBP_SAMPLE + '\n')?.pnr).toBe('ABC123');
  });

  it('strips leading zeros from flight number and seat', () => {
    const pass = parseBcbp(BCBP_SAMPLE);
    expect(pass?.flightNumber).toBe('834');
    expect(pass?.seat).toBe('1A');
  });

  it('drops individual garbled fields without sinking the rest', () => {
    // Origin corrupted to digits; everything else intact.
    const corrupted = BCBP_SAMPLE.slice(0, 30) + '9#1' + BCBP_SAMPLE.slice(33);
    const pass = parseBcbp(corrupted);
    expect(pass?.origin).toBeUndefined();
    expect(pass?.dest).toBe('FRA');
    expect(pass?.flightNumber).toBe('834');
  });

  it('rejects payloads that are not boarding passes', () => {
    expect(parseBcbp('https://example.com/checkin?id=12345678901234567890123456789012345678901234567890')).toBeNull();
    expect(parseBcbp('M1 too short')).toBeNull();
    expect(parseBcbp('')).toBeNull();
  });
});

describe('julianToISODate', () => {
  it('converts a day-of-year within an explicit year', () => {
    expect(julianToISODate(326, 2025)).toBe('2025-11-22');
    expect(julianToISODate(1, 2026)).toBe('2026-01-01');
    expect(julianToISODate(32, 2026)).toBe('2026-02-01');
  });

  it('handles leap years', () => {
    expect(julianToISODate(60, 2024)).toBe('2024-02-29');
    expect(julianToISODate(60, 2025)).toBe('2025-03-01');
  });

  it('rejects out-of-range input', () => {
    expect(julianToISODate(0, 2026)).toBeUndefined();
    expect(julianToISODate(367, 2026)).toBeUndefined();
    expect(julianToISODate(1.5, 2026)).toBeUndefined();
  });

  it('resolves to a plausible upcoming date when no year is given', () => {
    const iso = julianToISODate(180);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Never more than two weeks in the past (rolls to next year instead).
    const resolved = new Date(`${iso}T00:00:00`);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);
    expect(resolved.getTime()).toBeGreaterThan(cutoff.getTime());
  });
});

// ── Confirmation text ────────────────────────────────────────────────────────

const SAMPLE_EMAIL = `
Your trip is confirmed!

Confirmation code: HXR7QK
Flight: AA 100
JFK → LAX
Departs March 15, 2026 at 9:30 AM
Seat: 14A
Total: $1,299.00

Thanks for flying with us.
`;

describe('parseConfirmationText', () => {
  it('extracts every field from a typical airline confirmation email', () => {
    expect(parseConfirmationText(SAMPLE_EMAIL)).toEqual({
      confirmation: 'HXR7QK',
      carrier: 'AA',
      flightNumber: '100',
      origin: 'JFK',
      dest: 'LAX',
      date: '2026-03-15',
      time: '09:30',
      seat: '14A',
      amount: 1299,
      currency: 'USD',
    });
  });

  it("matches the 'JFK to LAX' route form and code-prefixed amounts", () => {
    const parsed = parseConfirmationText(
      'Booking ref: Z9Y8X7 — your flight DL2244 from JFK to LAX. Total EUR 450.50',
    );
    expect(parsed.confirmation).toBe('Z9Y8X7');
    expect(parsed.carrier).toBe('DL');
    expect(parsed.flightNumber).toBe('2244');
    expect(parsed.origin).toBe('JFK');
    expect(parsed.dest).toBe('LAX');
    expect(parsed.amount).toBe(450.5);
    expect(parsed.currency).toBe('EUR');
  });

  it('parses PM times, day-first dates, and amount-then-code currency', () => {
    const parsed = parseConfirmationText(
      'PNR: AB12CD. Departure 15 March 2026 at 4:05 pm. Fare 899.00 CAD.',
    );
    expect(parsed.confirmation).toBe('AB12CD');
    expect(parsed.date).toBe('2026-03-15');
    expect(parsed.time).toBe('16:05');
    expect(parsed.amount).toBe(899);
    expect(parsed.currency).toBe('CAD');
  });

  it('does not mistake lowercase prose for a confirmation code', () => {
    expect(parseConfirmationText('A confirmation email is on its way.').confirmation).toBeUndefined();
  });

  it('returns an empty result for empty or signal-free text', () => {
    expect(parseConfirmationText('')).toEqual({});
    expect(parseConfirmationText('See you soon!')).toEqual({});
  });
});
