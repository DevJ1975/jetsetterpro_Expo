// Boarding-pass presentation data — resolves a WalletItem (or a bare flight
// ident) into everything the Apple-Wallet-style card renders. Unknown fields
// degrade to deterministic demo values seeded from the ident (never
// Math.random, per the react-compiler rules).

import { Platform } from 'react-native';
import type { Trip } from '@/src/types/models';
import { passesFromTrips, type WalletItem } from '@/src/core/store/wallet';
import { airlineDisplayName, carrierCode } from '@/src/features/checkin/airlineLinks';
import {
  deterministicGate,
  deterministicGroup,
  deterministicPNR,
  deterministicSeat,
} from '@/src/features/checkin/flightHash';

export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ── Merged wallet source (itinerary-derived + stored) ───────────────────────

/** All wallet documents: itinerary-derived passes merged with stored items,
 *  sorted by date ascending (iOS sorts `$0.date < $1.date`). */
export function mergeWalletItems(trips: Trip[], stored: WalletItem[]): WalletItem[] {
  return [...passesFromTrips(trips), ...stored].sort((a, b) =>
    (a.date ?? '9999').localeCompare(b.date ?? '9999'),
  );
}

export function findWalletItem(
  trips: Trip[],
  stored: WalletItem[],
  id: string,
): WalletItem | undefined {
  return mergeWalletItems(trips, stored).find((x) => x.id === id);
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

/** Flight ident from free text — tolerant of 'JL 006 · NRT → LAX'. */
export function extractIdent(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.toUpperCase().match(/\b([A-Z]{2})\s?(\d{1,4})\b/);
  return m ? `${m[1]}${m[2]}` : undefined;
}

/** 'JFK → NRT' / 'JFK-NRT' / 'JFK to NRT' → { origin, destination }. */
export function parseRoute(
  text?: string,
): { origin: string; destination: string } | undefined {
  if (!text) return undefined;
  const m = text.toUpperCase().match(/\b([A-Z]{3})\s*(?:→|->|–|—|TO)\s*([A-Z]{3})\b/);
  return m ? { origin: m[1], destination: m[2] } : undefined;
}

// ── iOS lookup tables (BoardingPassCard.swift) ───────────────────────────────

/** Airline brand colors, ported 1:1 from iOS `BoardingPassCard.brandColor`. */
const BRAND_COLORS: Record<string, string> = {
  AA: '#0078D2',
  EK: '#D71921',
  DL: '#E01933',
  UA: '#005DAA',
  BA: '#075AAA',
  JL: '#E60012',
  NH: '#13448F',
  AF: '#002B7F',
  LH: '#05164D',
};
const BRAND_DEFAULT = '#0066CC';

export function brandColorFor(ident?: string): string {
  if (!ident) return BRAND_DEFAULT;
  return BRAND_COLORS[carrierCode(ident)] ?? BRAND_DEFAULT;
}

/** IATA → city, ported from iOS `BoardingPassCard.cityName`. */
const CITY_NAMES: Record<string, string> = {
  JFK: 'New York', LGA: 'New York', EWR: 'Newark',
  LAX: 'Los Angeles', SFO: 'San Francisco', ORD: 'Chicago',
  ATL: 'Atlanta', MIA: 'Miami', BOS: 'Boston', SEA: 'Seattle',
  DFW: 'Dallas', DEN: 'Denver', LAS: 'Las Vegas',
  NRT: 'Tokyo', HND: 'Tokyo', KIX: 'Osaka',
  LHR: 'London', LGW: 'London', CDG: 'Paris', AMS: 'Amsterdam',
  FRA: 'Frankfurt', MAD: 'Madrid', BCN: 'Barcelona',
  FCO: 'Rome', DXB: 'Dubai', DOH: 'Doha', SIN: 'Singapore',
  HKG: 'Hong Kong', ICN: 'Seoul', SYD: 'Sydney',
  YYZ: 'Toronto', MEX: 'Mexico City',
};

export function cityNameFor(iata?: string): string {
  if (!iata) return '';
  return CITY_NAMES[iata.toUpperCase()] ?? iata.toUpperCase();
}

/** Best-effort cabin from the seat row (iOS `classFromSeat` heuristic) —
 *  always presented with an "(est.)" label, never as fact. */
export function cabinFromSeat(seat?: string): string {
  const row = seat ? parseInt(seat, 10) : NaN;
  if (!Number.isFinite(row)) return '—';
  if (row <= 4) return 'FIRST';
  if (row <= 10) return 'BUSINESS';
  if (row <= 25) return 'PREMIUM';
  return 'ECONOMY';
}

// ── PassData ─────────────────────────────────────────────────────────────────

export interface PassData {
  ident: string;
  airline: string;
  brandColor: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  /** ISO departure instant, when known. */
  departISO?: string;
  passenger: string;
  cabin: string;
  cabinEstimated: boolean;
  seat: string;
  gate: string;
  group: string;
  /** Confirmation / record locator — also the QR payload. */
  code: string;
}

export interface PassDataOverrides {
  ident?: string;
  date?: string;
  seat?: string;
  passengerName?: string;
}

/** Resolve a boarding-pass view model. Explicit overrides win over wallet-item
 *  fields, which win over text parsing, which wins over hash-derived demo
 *  fallbacks (deterministic per ident). */
export function buildPassData(item: WalletItem | undefined, over: PassDataOverrides = {}): PassData {
  const ident = (
    over.ident ??
    item?.ident ??
    extractIdent(item?.title) ??
    extractIdent(item?.subtitle) ??
    'JS100'
  ).toUpperCase();

  const route =
    item?.origin && item?.destination
      ? { origin: item.origin, destination: item.destination }
      : (parseRoute(item?.title) ?? parseRoute(item?.location) ?? parseRoute(item?.subtitle));
  const origin = (route?.origin ?? '').toUpperCase();
  const destination = (route?.destination ?? '').toUpperCase();

  const seat = over.seat ?? item?.seat ?? deterministicSeat(ident);
  const gateFromLocation = item?.location?.match(/gate\s*([A-Z]?\d+[A-Z]?)/i)?.[1]?.toUpperCase();
  const passenger = over.passengerName?.trim()
    ? over.passengerName.trim().toUpperCase()
    : 'PASSENGER NAME';

  return {
    ident,
    airline: item?.airline ?? airlineDisplayName(ident),
    brandColor: brandColorFor(ident),
    origin: origin || '—',
    originCity: cityNameFor(origin),
    destination: destination || '—',
    destinationCity: cityNameFor(destination),
    departISO: over.date ?? item?.date,
    passenger,
    cabin: cabinFromSeat(seat),
    cabinEstimated: true,
    seat,
    gate: gateFromLocation ?? deterministicGate(ident),
    group: deterministicGroup(ident),
    code: item?.code ?? deterministicPNR(ident),
  };
}

/** Find the merged wallet boarding pass matching a flight ident, if any. */
export function findPassByIdent(
  trips: Trip[],
  stored: WalletItem[],
  ident: string,
): WalletItem | undefined {
  const target = ident.toUpperCase();
  return mergeWalletItems(trips, stored).find(
    (x) =>
      x.kind === 'boardingPass' &&
      ((x.ident && x.ident.toUpperCase() === target) || extractIdent(x.title) === target),
  );
}
