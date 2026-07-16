import { formatDate, formatTime } from '@/src/core/format';
import type { RankedOffer, SearchAndRankResult } from '@/src/core/api/flightAgent';
import type { DuffelOfferSummary, DuffelOrderSummary } from '@/src/core/api/duffel';

// Pure logic behind IRIS's in-chat flight booking — validation, payload
// construction, and the strings the model/user see. Kept side-effect-free so
// every money-adjacent rule is unit-testable (see src/__tests__/irisBooking).

export interface PassengerDraft {
  givenName: string;
  familyName: string;
  bornOn: string; // YYYY-MM-DD
  gender: 'm' | 'f';
  title: 'mr' | 'ms' | 'mrs' | 'dr';
  email: string;
  phone: string; // E.164, e.g. +14155550123
}

export type PassengerValidation =
  | { ok: true; passenger: PassengerDraft }
  | { ok: false; problems: string[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/; // E.164
const GENDERS = new Set(['m', 'f']);
const TITLES = new Set(['mr', 'ms', 'mrs', 'dr']);

function realDate(iso: string): Date | null {
  if (!DATE_RE.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject rollovers like 2026-02-31 → Mar 3.
  return d.toISOString().slice(0, 10) === iso ? d : null;
}

/** Validate conversationally-collected passenger identity. Aggregates every
 *  problem so the model can re-ask for all of them in one turn. */
export function validatePassenger(
  input: Record<string, unknown>,
  now: Date = new Date(),
): PassengerValidation {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
  const givenName = s('givenName');
  const familyName = s('familyName');
  const bornOn = s('bornOn');
  const gender = s('gender').toLowerCase();
  const title = s('title').toLowerCase();
  const email = s('email');
  const phone = s('phone').replace(/[\s()-]/g, '');

  const problems: string[] = [];
  if (!givenName) problems.push('given (first) name is missing');
  if (!familyName) problems.push('family (last) name is missing');
  const dob = realDate(bornOn);
  if (!dob) {
    problems.push('date of birth must be a real date in YYYY-MM-DD format');
  } else {
    const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) problems.push('passenger must be an adult (18+) to book here');
    else if (age > 110) problems.push('date of birth looks implausible — please re-check');
  }
  if (!GENDERS.has(gender)) problems.push("gender must be 'm' or 'f' (airline requirement)");
  if (!TITLES.has(title)) problems.push("title must be one of mr, ms, mrs, dr");
  if (!EMAIL_RE.test(email)) problems.push('email address looks invalid');
  if (!PHONE_RE.test(phone)) problems.push('phone must include the country code, e.g. +14155550123');

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    passenger: {
      givenName,
      familyName,
      bornOn,
      gender: gender as 'm' | 'f',
      title: title as PassengerDraft['title'],
      email,
      phone,
    },
  };
}

/** The exact CreateOrderPayload shape `duffelApi createOrder` forwards to
 *  Duffel — same contract the DuffelAncillaries WebView produces. The
 *  passenger id MUST be the Duffel-issued id from the fresh offer. */
export function buildCreateOrderPayload(
  offer: { id: string; passengers: { id: string }[] },
  p: PassengerDraft,
) {
  return {
    selected_offers: [offer.id] as [string],
    services: [] as { id: string; quantity: number }[],
    passengers: [
      {
        id: offer.passengers[0]?.id ?? '',
        given_name: p.givenName,
        family_name: p.familyName,
        born_on: p.bornOn,
        gender: p.gender,
        title: p.title,
        email: p.email,
        phone_number: p.phone,
      },
    ],
  };
}

/** Map a FULL Duffel offer (from getOffer — nested objects, e.g. origin as
 *  {iata_code}) to the flat DuffelOfferSummary shape the confirmation card and
 *  payload builder consume. Tolerant of missing fields. */
export function fullOfferToSummary(fullOffer: Record<string, unknown>): DuffelOfferSummary {
  const o = fullOffer as {
    id?: string;
    total_amount?: string;
    total_currency?: string;
    expires_at?: string;
    owner?: { name?: string; iata_code?: string };
    slices?: {
      origin?: { iata_code?: string };
      destination?: { iata_code?: string };
      duration?: string;
      segments?: { departing_at?: string; arriving_at?: string }[];
    }[];
    passengers?: { id?: string; type?: string }[];
  };
  return {
    id: o.id ?? '',
    total_amount: o.total_amount ?? '',
    total_currency: o.total_currency ?? '',
    expires_at: o.expires_at,
    owner: o.owner ? { name: o.owner.name, iata_code: o.owner.iata_code } : undefined,
    slices: (o.slices ?? []).map((s) => ({
      origin: s.origin?.iata_code,
      destination: s.destination?.iata_code,
      duration: s.duration,
      segments: (s.segments ?? []).map((seg) => ({
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
      })),
    })),
    passengers: (o.passengers ?? []).flatMap((p) => (p.id ? [{ id: p.id, type: p.type ?? 'adult' }] : [])),
  };
}

/** Offers expire (~30 min from search). Treat missing expiry as expired —
 *  conservative, because booking an expired offer fails at Duffel anyway. */
export function offerExpired(
  expiresAt: string | undefined,
  skewMs = 90_000,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t - now < skewMs;
}

function routeOf(offer: DuffelOfferSummary): string {
  const s0 = offer.slices?.[0];
  const back = (offer.slices?.length ?? 0) > 1 ? ' (round trip)' : '';
  return `${s0?.origin ?? '?'}→${s0?.destination ?? '?'}${back}`;
}

/** Multi-line summary for the ConfirmationCard — must carry route, date,
 *  carrier, TOTAL price+currency, and the passenger's full name. */
export function summarizeBookingForConfirm(offer: DuffelOfferSummary, p: PassengerDraft): string {
  const depart = offer.slices?.[0]?.segments?.[0]?.departing_at;
  const when = depart ? ` ${formatDate(depart)}` : '';
  const carrier = offer.owner?.name ? ` · ${offer.owner.name}` : '';
  return (
    `Book ${routeOf(offer)}${when}${carrier}\n` +
    `Total ${offer.total_amount} ${offer.total_currency} (test mode)\n` +
    `Passenger: ${p.givenName} ${p.familyName}`
  );
}

/** Compact transcript block for search results — the ONLY offer data the
 *  model sees client-side, so it stays small and carries the expiry rule. */
export function formatRankedOffers(
  r: SearchAndRankResult,
  q: { origin: string; destination: string; departureDate: string },
): string {
  if (r.topOffers.length === 0) {
    return `No bookable flights found for ${q.origin}→${q.destination} on ${q.departureDate}. Suggest trying different dates or nearby airports.`;
  }
  const line = (o: RankedOffer, i: number) => {
    const times =
      o.departISO && o.arriveISO ? `, dep ${formatTime(o.departISO)} arr ${formatTime(o.arriveISO)}` : '';
    const stops = o.stops === 0 ? 'nonstop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`;
    const why = o.reason ? ` (${o.reason})` : '';
    return `${i + 1}. ${o.offerId} — ${o.carrier ?? 'Airline'}${times}, ${stops} — ${o.totalAmount} ${o.totalCurrency}${why}`;
  };
  return (
    `FLIGHTS ${q.origin}→${q.destination} ${q.departureDate} (fares expire ~30 min after search — re-search if stale):\n` +
    r.topOffers.map(line).join('\n') +
    `\nNOTES: ${r.summary}\n` +
    `To book: confirm the passenger's full identity with the user, then call bookFlight with the offerId.`
  );
}

/** Tolerant trim of a FULL Duffel offer (from getOffer) for the transcript. */
export function trimOfferDetailsForModel(fullOffer: Record<string, unknown>): string {
  const o = fullOffer as {
    id?: string;
    total_amount?: string;
    total_currency?: string;
    expires_at?: string;
    conditions?: {
      change_before_departure?: { allowed?: boolean; penalty_amount?: string; penalty_currency?: string } | null;
      refund_before_departure?: { allowed?: boolean; penalty_amount?: string; penalty_currency?: string } | null;
    };
    slices?: { segments?: { passengers?: { baggages?: { type?: string; quantity?: number }[] }[] }[] }[];
  };
  const cond = (
    c?: { allowed?: boolean; penalty_amount?: string; penalty_currency?: string } | null,
  ): string =>
    !c
      ? 'unknown'
      : `${c.allowed ? 'allowed' : 'not allowed'}${c.penalty_amount ? ` (penalty ${c.penalty_amount} ${c.penalty_currency ?? ''})` : ''}`;
  let bags = 0;
  try {
    bags = (o.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages ?? [])
      .filter((b) => b.type === 'checked')
      .reduce((n, b) => n + (b.quantity ?? 0), 0);
  } catch {
    bags = 0;
  }
  const price = o.total_amount ? `${o.total_amount} ${o.total_currency ?? ''}`.trim() : 'unknown';
  const expiry = offerExpired(o.expires_at)
    ? 'EXPIRED — search again before booking'
    : `valid until ${o.expires_at}`;
  return (
    `OFFER ${o.id ?? '?'}: total ${price}; ${expiry}; ` +
    `changes ${cond(o.conditions?.change_before_departure)}; ` +
    `refund ${cond(o.conditions?.refund_before_departure)}; ` +
    `checked bags included: ${bags}.`
  );
}

/** Transcript block for the user's existing bookings. */
export function describeOrders(orders: DuffelOrderSummary[]): string {
  if (!orders || orders.length === 0) return 'No bookings yet.';
  const lines = orders.map((ord) => {
    const s0 = ord.slices?.[0];
    const route = s0 ? `${s0.origin ?? '?'}→${s0.destination ?? '?'}` : 'route unknown';
    const when = s0?.departingAt ? ` ${formatDate(s0.departingAt)}` : '';
    const price = ord.totalAmount ? ` — ${ord.totalAmount} ${ord.totalCurrency ?? ''}`.trimEnd() : '';
    const state = ord.cancelled
      ? ` [CANCELLED${ord.refundAmount ? `, refunded ${ord.refundAmount} ${ord.refundCurrency ?? ''}`.trimEnd() + ']' : ']'}`
      : '';
    return `- ${ord.id} (${ord.bookingReference ?? 'ref n/a'}): ${route}${when}${price}${state}`;
  });
  return `BOOKINGS:\n${lines.join('\n')}`;
}
