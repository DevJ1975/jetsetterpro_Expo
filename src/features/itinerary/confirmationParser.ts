// Best-effort heuristic parser for pasted booking-confirmation text (e.g. a
// forwarded airline/hotel/rental email). RN port of the iOS
// `Core/Utilities/ConfirmationTextParser.swift` (confirmation code, route,
// amount+currency), extended with airline+flight number, date, time, and seat
// extraction for the add-item form. It is deliberately conservative — only
// fields matched with high confidence are returned, and the user always lands
// in the editable form to confirm. Pure TypeScript, no React Native imports.

/** Fields we attempt to recover from pasted confirmation text. All optional. */
export interface ParsedConfirmation {
  confirmation?: string;
  /** Airline designator, e.g. 'AA'. */
  carrier?: string;
  /** Flight number digits (leading zeros stripped), e.g. '100'. */
  flightNumber?: string;
  origin?: string;
  dest?: string;
  /** 'YYYY-MM-DD' */
  date?: string;
  /** 'HH:MM' 24-hour */
  time?: string;
  seat?: string;
  amount?: number;
  currency?: string;
}

export function parseConfirmationText(text: string): ParsedConfirmation {
  const result: ParsedConfirmation = {};
  if (typeof text !== 'string' || !text.trim()) return result;

  const confirmation = findConfirmation(text);
  if (confirmation) result.confirmation = confirmation;

  const flight = findFlight(text);
  if (flight) {
    result.carrier = flight.carrier;
    result.flightNumber = flight.flightNumber;
  }

  const route = findRoute(text);
  if (route) {
    result.origin = route.origin;
    result.dest = route.dest;
  }

  const date = findDate(text);
  if (date) result.date = date;

  const time = findTime(text);
  if (time) result.time = time;

  const seat = findSeat(text);
  if (seat) result.seat = seat;

  const money = findAmount(text);
  if (money) {
    result.amount = money.amount;
    result.currency = money.currency;
  }

  return result;
}

// ── Confirmation code ────────────────────────────────────────────────────────

// A labeled confirmation/booking/PNR code, e.g. "Confirmation #: ABC123" (iOS pattern).
const CONFIRMATION_RE =
  /(?:confirmation|booking|reservation|record\s*locator|itinerary|pnr)(?:\s*(?:number|code|reference|ref|id|no\.?|#))?\s*[:#-]?\s*([A-Z0-9]{5,8})\b/i;

function findConfirmation(text: string): string | undefined {
  const m = CONFIRMATION_RE.exec(text);
  if (!m) return undefined;
  const code = m[1];
  // Guard against prose after the label ("confirmation email…"): only accept
  // codes that carry a digit or were fully uppercase in the source text.
  if (!/\d/.test(code) && code !== code.toUpperCase()) return undefined;
  return code.toUpperCase();
}

// ── Airline + flight number ──────────────────────────────────────────────────

// Labeled form first ("Flight: AA 100", "flight #AA100")…
const LABELED_FLIGHT_RE = /flight\s*(?:number|no\.?|#)?\s*:?\s*([A-Z][A-Z0-9])\s?(\d{1,4})\b/i;
// …then a bare uppercase designator anywhere ("AA 100", "DL2244").
const BARE_FLIGHT_RE = /\b([A-Z]{2})\s?(\d{1,4})\b/;

function findFlight(text: string): { carrier: string; flightNumber: string } | undefined {
  const labeled = LABELED_FLIGHT_RE.exec(text);
  // The labeled pattern is case-insensitive; require the designator itself to
  // have been uppercase in the source so prose like "flight on 15 March"
  // doesn't read as carrier "ON".
  const m = labeled && labeled[1] === labeled[1].toUpperCase() ? labeled : BARE_FLIGHT_RE.exec(text);
  if (!m) return undefined;
  return {
    carrier: m[1].toUpperCase(),
    flightNumber: m[2].replace(/^0+(?=\d)/, ''),
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

// IATA pair like "SFO → JFK", "SFO-JFK", or "SFO to LAX" (iOS pattern + "to").
const ROUTE_RE = /\b([A-Z]{3})\s*(?:->|→|–|—|-|to|TO)\s*([A-Z]{3})\b/;

function findRoute(text: string): { origin: string; dest: string } | undefined {
  const m = ROUTE_RE.exec(text);
  return m ? { origin: m[1], dest: m[2] } : undefined;
}

// ── Date ─────────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_PART =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const ISO_DATE_RE = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/;
// "March 15, 2026" / "Mar 15 2026" / "March 15th, 2026"
const MONTH_FIRST_RE = new RegExp(
  `\\b${MONTH_PART}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`,
  'i',
);
// "15 March 2026" / "15th Mar, 2026"
const DAY_FIRST_RE = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PART}\\.?,?\\s+(20\\d{2})\\b`,
  'i',
);
// "03/15/2026" — treated as US month/day/year.
const NUMERIC_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/;

function findDate(text: string): string | undefined {
  let m = ISO_DATE_RE.exec(text);
  if (m) return composeDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = MONTH_FIRST_RE.exec(text);
  if (m) return composeDate(Number(m[3]), monthNumber(m[1]), Number(m[2]));
  m = DAY_FIRST_RE.exec(text);
  if (m) return composeDate(Number(m[3]), monthNumber(m[2]), Number(m[1]));
  m = NUMERIC_DATE_RE.exec(text);
  if (m) return composeDate(Number(m[3]), Number(m[1]), Number(m[2]));
  return undefined;
}

function monthNumber(name: string): number {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? 0;
}

function composeDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Time ─────────────────────────────────────────────────────────────────────

const TIME_RE = /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i;

function findTime(text: string): string | undefined {
  const m = TIME_RE.exec(text);
  if (!m) return undefined;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase().replace(/\./g, '');
  if (minutes > 59) return undefined;
  if (meridiem) {
    if (hours < 1 || hours > 12) return undefined;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return undefined;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ── Seat ─────────────────────────────────────────────────────────────────────

const SEAT_RE = /\bseat\s*(?:number|no\.?|#)?\s*:?\s*(\d{1,3}\s?[A-K])\b/i;

function findSeat(text: string): string | undefined {
  const m = SEAT_RE.exec(text);
  return m ? m[1].replace(/\s+/g, '').toUpperCase() : undefined;
}

// ── Amount + currency ────────────────────────────────────────────────────────

const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
};
const KNOWN_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'HKD', 'SGD', 'AED', 'MXN', 'BRL', 'INR', 'NZD',
];

const NUM_PART = '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';
const CODE_ALT = KNOWN_CODES.join('|');
// "$1,299.00"
const SYMBOL_AMOUNT_RE = new RegExp(`([$€£¥])\\s*${NUM_PART}`);
// "USD 1,299.00"
const CODE_AMOUNT_RE = new RegExp(`\\b(${CODE_ALT})\\s*${NUM_PART}`, 'i');
// "1,299.00 USD"
const AMOUNT_CODE_RE = new RegExp(`${NUM_PART}\\s*\\b(${CODE_ALT})\\b`, 'i');

/** Extracts a total/price and its currency: symbol-prefixed, then
 *  code-prefixed, then amount-then-code (iOS order). */
function findAmount(text: string): { amount: number; currency: string } | undefined {
  let m = SYMBOL_AMOUNT_RE.exec(text);
  if (m) {
    const amount = parseDecimal(m[2]);
    const currency = SYMBOL_TO_CODE[m[1]];
    if (amount != null && currency) return { amount, currency };
  }
  m = CODE_AMOUNT_RE.exec(text);
  if (m) {
    const amount = parseDecimal(m[2]);
    if (amount != null) return { amount, currency: m[1].toUpperCase() };
  }
  m = AMOUNT_CODE_RE.exec(text);
  if (m) {
    const amount = parseDecimal(m[1]);
    if (amount != null) return { amount, currency: m[2].toUpperCase() };
  }
  return undefined;
}

function parseDecimal(raw: string): number | undefined {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}
