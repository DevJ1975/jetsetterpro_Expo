import { useQueries, useQuery } from '@tanstack/react-query';
import { authedGet, isBackendConfigured } from './backend';

// Live flight data via the `flightData` Cloud Function (AeroDataBox behind a
// provider adapter, Firestore-cached server-side so all users share entries).

export type FlightStatusCode =
  | 'scheduled'
  | 'boarding'
  | 'departed'
  | 'enroute'
  | 'landed'
  | 'arrived'
  | 'delayed'
  | 'cancelled'
  | 'diverted'
  | 'unknown';

export interface FlightTimes {
  scheduled?: string; // ISO-8601 with offset (airport-local)
  estimated?: string;
  actual?: string;
}

export interface FlightEndpoint {
  iata: string;
  icao?: string;
  name?: string;
  city?: string;
  terminal?: string;
  gate?: string;
  baggageClaim?: string;
  times: FlightTimes;
}

export interface FlightPosition {
  lat: number;
  lon: number;
  altFt?: number;
  speedKts?: number;
  heading?: number;
  at: string;
}

export interface FlightStatus {
  ident: string;
  airline?: { iata?: string; name?: string };
  date: string; // YYYY-MM-DD, origin-local
  status: FlightStatusCode;
  delayMin?: number;
  origin: FlightEndpoint;
  destination: FlightEndpoint;
  aircraft?: { model?: string; reg?: string; icao24?: string };
  position?: FlightPosition | null;
  source: string;
  fetchedAt: string;
  stale?: boolean;
}

/** Human-readable status label + tone, matching the iOS status pills. */
export function statusLabel(s: FlightStatusCode, delayMin?: number): string {
  switch (s) {
    case 'scheduled':
      return 'ON TIME';
    case 'boarding':
      return 'BOARDING';
    case 'departed':
      return 'DEPARTED';
    case 'enroute':
      return 'EN ROUTE';
    case 'landed':
      return 'LANDED';
    case 'arrived':
      return 'ARRIVED';
    case 'delayed':
      return delayMin ? `DELAYED ${delayMin}m` : 'DELAYED';
    case 'cancelled':
      return 'CANCELLED';
    case 'diverted':
      return 'DIVERTED';
    default:
      return '—';
  }
}

export function statusTone(s: FlightStatusCode): 'good' | 'warn' | 'bad' | 'neutral' {
  if (s === 'delayed') return 'warn';
  if (s === 'cancelled' || s === 'diverted') return 'bad';
  if (s === 'unknown') return 'neutral';
  return 'good';
}

/** The live-refresh window: dep − 6h … arr + 2h (per the cache TTL policy). */
export function inFlightWindow(f: FlightStatus | undefined, now = Date.now()): boolean {
  if (!f) return false;
  const dep = Date.parse(f.origin.times.estimated ?? f.origin.times.scheduled ?? '');
  const arr = Date.parse(f.destination.times.estimated ?? f.destination.times.scheduled ?? '');
  if (!Number.isFinite(dep)) return false;
  const end = Number.isFinite(arr) ? arr + 2 * 3600_000 : dep + 18 * 3600_000;
  return now >= dep - 6 * 3600_000 && now <= end;
}

export async function fetchFlightStatus(ident: string, date: string): Promise<FlightStatus | null> {
  try {
    const { flight } = await authedGet<{ flight: FlightStatus }>('flightData', {
      op: 'status',
      ident,
      date,
    });
    return flight;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export async function fetchFlightPosition(
  ident: string,
  date: string,
): Promise<FlightPosition | null> {
  const { position } = await authedGet<{ position: FlightPosition | null }>('flightData', {
    op: 'position',
    ident,
    date,
  });
  return position;
}

const statusQuery = (ident: string | null | undefined, date: string | null | undefined) => ({
  queryKey: ['flight', ident, date] as const,
  queryFn: () => fetchFlightStatus(ident as string, date as string),
  enabled: Boolean(ident && date) && isBackendConfigured(),
  staleTime: 4 * 60_000,
  refetchInterval: (query: { state: { data?: FlightStatus | null } }) =>
    inFlightWindow(query.state.data ?? undefined) ? 60_000 : false,
});

/** Live status for one flight; polls every 60s only inside the flight window. */
export function useFlightStatus(ident?: string | null, date?: string | null) {
  return useQuery(statusQuery(ident, date));
}

/** Live statuses for a set of flights (departure board rows). */
export function useFlightStatuses(flights: { ident: string; date: string }[]) {
  return useQueries({ queries: flights.map((f) => statusQuery(f.ident, f.date)) });
}

/** Live aircraft position — polls every 60s while the flight is enroute. */
export function useFlightPosition(status?: FlightStatus | null) {
  const active = status?.status === 'enroute' || status?.status === 'departed';
  return useQuery({
    queryKey: ['flightPos', status?.ident, status?.date],
    queryFn: () => fetchFlightPosition(status!.ident, status!.date),
    enabled: Boolean(active) && isBackendConfigured(),
    refetchInterval: active ? 60_000 : false,
  });
}
