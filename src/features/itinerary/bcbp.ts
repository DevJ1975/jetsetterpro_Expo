// IATA Bar Coded Boarding Pass (BCBP, Resolution 792) parser — the "M1…"
// payload inside the PDF417/Aztec/QR barcode on a boarding pass. RN port of the
// iOS `Core/Utilities/BCBPParser.swift`: only the mandatory fixed-width section
// is read (enough to prefill the flight-entry form); conditional/airline-private
// sections are ignored. Pure TypeScript — no React Native imports — so it stays
// unit-testable.
//
// Mandatory-section layout (single leg), offsets per IATA Res. 792:
//   0  'M' format code      1  leg count
//   2  passenger name (20, "LASTNAME/FIRSTNAME")
//  22  e-ticket indicator  23  PNR (7)
//  30  origin (3)          33  destination (3)      36  carrier (3)
//  39  flight number (5)   44  julian date (3)      47  cabin (1)
//  48  seat (4)            52  check-in sequence (5)

/** The subset of a boarding pass we can reliably read from the BCBP mandatory
 *  fields. Everything is optional — a partial/garbled scan still prefills what
 *  it can and leaves the rest to the user. */
export interface ParsedBoardingPass {
  passengerName?: string;
  pnr?: string;
  origin?: string;
  dest?: string;
  carrier?: string;
  /** Digits (leading zeros stripped) plus optional alpha suffix, e.g. '100'. */
  flightNumber?: string;
  /** Day-of-year 1–366 — BCBP carries no year; see julianToISODate. */
  julianDate?: number;
  /** Leading zeros stripped, e.g. '14A'. */
  seat?: string;
}

/** Minimum payload length we accept: through the seat field (48 + 4). Real
 *  single-leg payloads are ≥ 60 chars, but a tolerant parser takes what fits. */
const MIN_LENGTH = 52;

/** Parses a raw BCBP payload. Returns null when the string doesn't look like a
 *  boarding pass (wrong prefix / too short) or yields no usable fields. Each
 *  field is validated independently, so one garbled field never sinks the rest. */
export function parseBcbp(raw: string): ParsedBoardingPass | null {
  if (typeof raw !== 'string') return null;
  // BCBP is ASCII; strip stray whitespace/newlines a scanner may include.
  const s = raw.trim();
  // Format code 'M' + leg count digit ("M1…" for a single leg).
  if (!/^M\d/.test(s) || s.length < MIN_LENGTH) return null;

  const field = (start: number, length: number): string =>
    s.slice(start, start + length).trim();
  const take = (value: string, re: RegExp): string | undefined =>
    value && re.test(value) ? value.toUpperCase() : undefined;

  const julianRaw = field(44, 3);
  const julian = /^\d{1,3}$/.test(julianRaw) ? Number(julianRaw) : NaN;

  const pass: ParsedBoardingPass = {};
  const passengerName = formatName(field(2, 20));
  if (passengerName) pass.passengerName = passengerName;
  const pnr = take(field(23, 7), /^[A-Z0-9]{5,7}$/i);
  if (pnr) pass.pnr = pnr;
  const origin = take(field(30, 3), /^[A-Z]{3}$/i);
  if (origin) pass.origin = origin;
  const dest = take(field(33, 3), /^[A-Z]{3}$/i);
  if (dest) pass.dest = dest;
  const carrier = take(field(36, 3), /^[A-Z0-9]{2,3}$/i);
  if (carrier) pass.carrier = carrier;
  const flightNumber = formatFlightNumber(field(39, 5));
  if (flightNumber) pass.flightNumber = flightNumber;
  if (julian >= 1 && julian <= 366) pass.julianDate = julian;
  const seat = formatSeat(field(48, 4));
  if (seat) pass.seat = seat;

  // If we recovered essentially nothing useful, treat it as a non-match.
  return Object.keys(pass).length > 0 ? pass : null;
}

/** Converts a BCBP day-of-year to 'YYYY-MM-DD'. With an explicit `year` the
 *  conversion is deterministic; without one it resolves to the occurrence
 *  nearest today going forward — rolling to next year when this year's date is
 *  more than two weeks past (a pass being entered is almost always upcoming),
 *  matching the iOS parser. Returns undefined for out-of-range input. */
export function julianToISODate(julian: number, year?: number): string | undefined {
  if (!Number.isInteger(julian) || julian < 1 || julian > 366) return undefined;
  if (year != null) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) return undefined;
    return isoDate(dateFromDayOfYear(year, julian));
  }
  const now = new Date();
  const thisYear = dateFromDayOfYear(now.getFullYear(), julian);
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  return isoDate(
    thisYear.getTime() < cutoff.getTime()
      ? dateFromDayOfYear(now.getFullYear() + 1, julian)
      : thisYear,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Reformats "LASTNAME/FIRSTNAME" into "Firstname Lastname" with light
 *  title-casing (iOS parity). Returns undefined for non-name-looking data. */
function formatName(raw: string): string | undefined {
  if (!raw || !/^[A-Z' .-]+(\/[A-Z' .-]*)?$/i.test(raw)) return undefined;
  const [last = '', first = ''] = raw.split('/', 2).map((p) => p.trim());
  const ordered = [first, last].filter(Boolean).join(' ');
  const pretty = ordered
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .trim();
  return pretty || undefined;
}

/** "0834 " → "834"; "0100A" → "100A". Undefined when it isn't a flight number. */
function formatFlightNumber(raw: string): string | undefined {
  if (!/^\d{1,4}[A-Z]?$/i.test(raw)) return undefined;
  const stripped = raw.replace(/^0+(?=.)/, '').toUpperCase();
  return stripped || undefined;
}

/** "001A" → "1A". Undefined for non-seat values (e.g. "INF", "GATE"). */
function formatSeat(raw: string): string | undefined {
  const m = /^0*(\d{1,3}[A-Z])$/i.exec(raw);
  return m ? m[1].toUpperCase() : undefined;
}

/** Day-of-year → local Date. JS Date rolls the overflow for us (day 32 → Feb 1). */
function dateFromDayOfYear(year: number, day: number): Date {
  return new Date(year, 0, day);
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
