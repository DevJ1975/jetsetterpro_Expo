// Ground-transport fare model — a LABELED HEURISTIC, not provider pricing.
//
// Uber's public price-estimate API needs app credentials and Lyft's is
// discontinued (see the iOS GroundTransportViewModel), so this module fabricates
// plausible fare ranges from a base + per-km curve. The UI must present these as
// estimates only; booking always hands off to the provider app for live quotes.
//
// Everything is deterministic (seeded hash, no Math.random/Date.now) so the same
// pickup/dropoff always yields the same list — render-safe under the React
// Compiler lint rules, and unit-testable.

import { airportCoord } from '@/src/core/data/airports';

export type RideProvider = 'uber' | 'lyft';

export interface LatLngLite {
  latitude: number;
  longitude: number;
}

export interface RideClassSpec {
  id: string;
  provider: RideProvider;
  name: string;
  seats: number;
  /** Flag-drop, USD. */
  base: number;
  /** Distance rate, USD per km. */
  perKm: number;
  /** Floor applied before the low/high spread. */
  minFare: number;
}

/** The fixed menu of classes shown on the screen, in display order. */
export const RIDE_CLASSES: readonly RideClassSpec[] = [
  { id: 'uberx', provider: 'uber', name: 'UberX', seats: 4, base: 3.0, perKm: 1.35, minFare: 9 },
  { id: 'uber-comfort', provider: 'uber', name: 'Uber Comfort', seats: 4, base: 4.5, perKm: 1.65, minFare: 12 },
  { id: 'uber-black', provider: 'uber', name: 'Uber Black', seats: 4, base: 8.0, perKm: 2.55, minFare: 19 },
  { id: 'lyft', provider: 'lyft', name: 'Lyft', seats: 4, base: 2.8, perKm: 1.3, minFare: 8 },
  { id: 'lyft-xl', provider: 'lyft', name: 'Lyft XL', seats: 6, base: 5.0, perKm: 1.85, minFare: 13 },
  { id: 'lyft-lux', provider: 'lyft', name: 'Lux', seats: 4, base: 7.5, perKm: 2.45, minFare: 18 },
];

/** Assumed trip length when the dropoff can't be resolved to coordinates. */
export const DEFAULT_TRIP_KM = 12;

/** Flat booking/service fee folded into every estimate. */
export const BOOKING_FEE = 2.75;

export interface RideEstimate {
  id: string;
  provider: RideProvider;
  name: string;
  seats: number;
  fareLow: number;
  fareHigh: number;
  /** "$24–31" */
  fareLabel: string;
  pickupEtaMin: number;
  /** "4 min" */
  etaLabel: string;
  /** Distance assumption the fares were computed from. */
  tripKm: number;
}

// ── Seeded pseudo-random (same scheme as the airport-map module) ─────────────

/** FNV-1a 32-bit hash of a string → unsigned int seed. */
export function seededHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic unit float in [0, 1) for a (seed, lane) pair. */
export function seededUnit(seed: number, lane: number): number {
  let t = (seed + Math.imul(lane + 1, 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── Distance guess ───────────────────────────────────────────────────────────

/** Haversine distance in km. */
export function haversineKm(a: LatLngLite, b: LatLngLite): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/** If the dropoff text names a known airport ("JFK Airport"), its coordinate. */
export function dropoffAirportCoord(dropoff: string): LatLngLite | null {
  const tokens = dropoff.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [];
  for (const token of tokens) {
    const c = airportCoord(token);
    if (c) return { latitude: c.lat, longitude: c.lon };
  }
  return null;
}

/**
 * Trip-length guess: when the dropoff is a known airport and we have a pickup
 * fix, use the great-circle distance padded ~25% for roads; otherwise assume a
 * DEFAULT_TRIP_KM city hop. (No geocoder is wired in for arbitrary addresses.)
 */
export function estimateTripKm(pickup: LatLngLite | null, dropoff: string): number {
  const airport = dropoffAirportCoord(dropoff);
  if (airport && pickup) {
    const km = haversineKm(pickup, airport) * 1.25;
    return Math.min(150, Math.max(1, Math.round(km * 10) / 10));
  }
  return DEFAULT_TRIP_KM;
}

// ── Estimates ────────────────────────────────────────────────────────────────

/** "$24–31" (whole dollars, en dash). */
export function formatFareRange(low: number, high: number): string {
  return `$${low}–${high}`;
}

/**
 * Build the full UberX…Lux estimate list for a pickup/dropoff pair. Pickup ETA
 * is a seeded 3–9 min figure per class+route so it reads live but never jumps
 * between renders.
 */
export function buildEstimates(pickup: LatLngLite | null, dropoff: string): RideEstimate[] {
  const tripKm = estimateTripKm(pickup, dropoff);
  const routeKey = dropoff.trim().toLowerCase();
  return RIDE_CLASSES.map((c) => {
    const mid = Math.max(c.minFare, c.base + BOOKING_FEE + c.perKm * tripKm);
    const fareLow = Math.max(1, Math.round(mid * 0.92));
    const fareHigh = Math.max(fareLow + 1, Math.round(mid * 1.18));
    const pickupEtaMin = 3 + Math.floor(seededUnit(seededHash(`${c.id}|${routeKey}`), 1) * 7);
    return {
      id: c.id,
      provider: c.provider,
      name: c.name,
      seats: c.seats,
      fareLow,
      fareHigh,
      fareLabel: formatFareRange(fareLow, fareHigh),
      pickupEtaMin,
      etaLabel: `${pickupEtaMin} min`,
      tripKm,
    };
  });
}

export function providerName(p: RideProvider): string {
  return p === 'uber' ? 'Uber' : 'Lyft';
}
