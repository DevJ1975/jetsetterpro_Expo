import type {
  CarSearchResult,
  ProductBooking,
  StaySearchResult,
} from '@/src/core/api/travelBookings';
import { isAtLeast } from '@/src/core/ai/iris/booking';

// Pure logic behind IRIS's in-chat hotel + car booking — identity validation
// and the transcript/confirmation strings. Side-effect-free so it's testable.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/; // E.164
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Guest {
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  specialRequests?: string;
}
export interface Driver extends Guest {
  date_of_birth: string; // YYYY-MM-DD
}

export type GuestValidation = { ok: true; guest: Guest } | { ok: false; problems: string[] };
export type DriverValidation = { ok: true; driver: Driver } | { ok: false; problems: string[] };

function baseIdentity(input: Record<string, unknown>): { problems: string[]; fields: Guest } {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
  const given_name = s('givenName');
  const family_name = s('familyName');
  const email = s('email');
  const phone_number = s('phone').replace(/[\s()-]/g, '');
  const problems: string[] = [];
  if (!given_name) problems.push('given (first) name is missing');
  if (!family_name) problems.push('family (last) name is missing');
  if (!EMAIL_RE.test(email)) problems.push('email address looks invalid');
  if (!PHONE_RE.test(phone_number)) problems.push('phone must include the country code, e.g. +14155550123');
  const specialRequests = s('specialRequests') || undefined;
  return { problems, fields: { given_name, family_name, email, phone_number, specialRequests } };
}

export function validateGuest(input: Record<string, unknown>): GuestValidation {
  const { problems, fields } = baseIdentity(input);
  return problems.length ? { ok: false, problems } : { ok: true, guest: fields };
}

export function validateDriver(input: Record<string, unknown>, now: Date = new Date()): DriverValidation {
  const { problems, fields } = baseIdentity(input);
  const dob = (typeof input.bornOn === 'string' ? input.bornOn : '').trim();
  if (!DATE_RE.test(dob) || Number.isNaN(Date.parse(`${dob}T00:00:00Z`))) {
    problems.push('driver date of birth must be a real date in YYYY-MM-DD format');
  } else {
    const d = new Date(`${dob}T00:00:00Z`);
    if (!isAtLeast(d, 18, now)) problems.push('driver must be at least 18');
    else if (isAtLeast(d, 111, now)) problems.push('driver date of birth looks implausible');
  }
  return problems.length ? { ok: false, problems } : { ok: true, driver: { ...fields, date_of_birth: dob } };
}

export function formatStayResults(results: StaySearchResult[], where: string): string {
  if (!results.length) return `No hotels found near ${where} for those dates. Try a wider area or different dates.`;
  const lines = results
    .slice(0, 6)
    .map(
      (r, i) =>
        `${i + 1}. ${r.id} — ${r.name ?? 'Hotel'}${r.rating ? ` (${r.rating}★)` : ''} — from ${r.amount ?? '?'} ${r.currency ?? ''}`.trim(),
    );
  return (
    `HOTELS near ${where} (Duffel test mode):\n${lines.join('\n')}\n` +
    `To book one, confirm the guest's full name, email and phone, then call bookHotel with its ssr_ id.`
  );
}

export function formatCarResults(results: CarSearchResult[], where: string): string {
  if (!results.length) return `No rental cars found at ${where} for those times.`;
  const lines = results
    .slice(0, 6)
    .map(
      (r, i) =>
        `${i + 1}. ${r.rateId} — ${r.car ?? 'Car'}${r.category ? ` (${r.category})` : ''}${r.transmission ? `, ${r.transmission}` : ''}${r.seats ? `, ${r.seats} seats` : ''} — ${r.amount ?? '?'} ${r.currency ?? ''}${r.supplier ? ` · ${r.supplier}` : ''}`.trim(),
    );
  return (
    `RENTAL CARS at ${where} (Duffel test mode):\n${lines.join('\n')}\n` +
    `To book one, confirm the driver's name, DOB, email and phone, then call bookCar with its rat_ id.`
  );
}

export function summarizeStayForConfirm(quote: {
  roomName?: string;
  amount?: string;
  currency?: string;
  refundable?: boolean;
  freeCancelBy?: string | null;
}, guest: Guest, where: string): string {
  const cancel = quote.refundable
    ? quote.freeCancelBy
      ? `Free cancellation until ${quote.freeCancelBy.slice(0, 10)}`
      : 'Refundable'
    : 'Non-refundable';
  return (
    `Book hotel near ${where}${quote.roomName ? ` · ${quote.roomName}` : ''}\n` +
    `Total ${quote.amount ?? '?'} ${quote.currency ?? ''} (test mode) · ${cancel}\n` +
    `Guest: ${guest.given_name} ${guest.family_name}`
  );
}

export function summarizeCarForConfirm(quote: { amount?: string; currency?: string }, driver: Driver, where: string): string {
  return (
    `Book rental car at ${where}\n` +
    `Total ${quote.amount ?? '?'} ${quote.currency ?? ''} (test mode)\n` +
    `Driver: ${driver.given_name} ${driver.family_name}`
  );
}

export function describeProductBookings(bookings: ProductBooking[], kind: 'hotel' | 'car'): string {
  if (!bookings.length) return kind === 'hotel' ? 'No hotel bookings yet.' : 'No car bookings yet.';
  const lines = bookings.map((b) => {
    const label =
      kind === 'hotel'
        ? `${b.accommodationName ?? 'Hotel'}${b.checkInDate ? ` ${b.checkInDate}→${b.checkOutDate ?? ''}` : ''}`
        : 'Rental car';
    const price = b.amount ? ` — ${b.amount} ${b.currency ?? ''}`.trimEnd() : '';
    const state = b.cancelled ? ' [CANCELLED]' : '';
    return `- ${b.id} (${b.reference ?? 'ref n/a'}): ${label}${price}${state}`;
  });
  return `${kind === 'hotel' ? 'HOTEL' : 'CAR'} BOOKINGS:\n${lines.join('\n')}`;
}
