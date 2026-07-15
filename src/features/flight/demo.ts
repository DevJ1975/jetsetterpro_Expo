// Deterministic sample flight data — the RN analog of the iOS MockDataService
// path in FlightTrackerViewModel. Used whenever the flight-data backend is not
// configured so the tracker/detail/in-flight screens still present a complete,
// clearly-labeled (SAMPLE/DEMO) experience. No randomness: everything derives
// from the flight ident + the current hour, so values are stable across
// renders and re-mounts.

import type { FlightStatus } from '@/src/core/api/flights';
import { greatCircleKm } from '@/src/core/data/airports';
import { pad2 } from './util';

/** Curated city names + UTC offsets (minutes, east-positive, DST-naive) for
 *  the airports the demo content uses. Estimates only — labeled SAMPLE/EST. */
const AIRPORT_INFO: Record<string, { city: string; offset: number }> = {
  JFK: { city: 'New York', offset: -240 },
  LAX: { city: 'Los Angeles', offset: -420 },
  ORD: { city: 'Chicago', offset: -300 },
  SFO: { city: 'San Francisco', offset: -420 },
  SEA: { city: 'Seattle', offset: -420 },
  ATL: { city: 'Atlanta', offset: -240 },
  MIA: { city: 'Miami', offset: -240 },
  LHR: { city: 'London', offset: 60 },
  CDG: { city: 'Paris', offset: 120 },
  FRA: { city: 'Frankfurt', offset: 120 },
  AMS: { city: 'Amsterdam', offset: 120 },
  MAD: { city: 'Madrid', offset: 120 },
  DXB: { city: 'Dubai', offset: 240 },
  GRU: { city: 'São Paulo', offset: -180 },
  SIN: { city: 'Singapore', offset: 480 },
  HND: { city: 'Tokyo', offset: 540 },
  NRT: { city: 'Tokyo', offset: 540 },
  SYD: { city: 'Sydney', offset: 600 },
};

export function airportUtcOffsetMin(iata: string): number | null {
  return AIRPORT_INFO[iata.toUpperCase()]?.offset ?? null;
}

export function airportCity(iata: string): string {
  return AIRPORT_INFO[iata.toUpperCase()]?.city ?? iata.toUpperCase();
}

/** ISO-8601 with an explicit offset suffix, e.g. 2026-07-15T14:05:00-04:00. */
export function isoWithOffset(ms: number, offsetMin: number): string {
  const d = new Date(ms + offsetMin * 60_000);
  const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00`;
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `${date}T${time}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

const DEMO_ROUTES: { origin: string; dest: string; airline: string }[] = [
  { origin: 'JFK', dest: 'LAX', airline: 'United Airlines' },
  { origin: 'ORD', dest: 'JFK', airline: 'American Airlines' },
  { origin: 'SFO', dest: 'SEA', airline: 'Alaska Airlines' },
  { origin: 'ATL', dest: 'MIA', airline: 'Delta Air Lines' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100_000;
  return h;
}

/** Builds a plausible, deterministic FlightStatus for a searched ident.
 *  - date is today → an enroute flight ~40% along (anchored to the top of the
 *    current hour so times hold still and progress creeps forward);
 *  - future date → scheduled at 10:00 airport-local (every 4th ident delayed);
 *  - past date → landed. */
export function demoFlightStatus(
  ident: string,
  date: string,
  nowMs: number,
  route?: { origin: string; dest: string; airline?: string },
): FlightStatus {
  const id = ident.trim().toUpperCase() || 'JS100';
  const h = hash(id);
  const r = route ?? DEMO_ROUTES[h % DEMO_ROUTES.length];
  const oIata = r.origin.toUpperCase();
  const dIata = r.dest.toUpperCase();
  const oOff = airportUtcOffsetMin(oIata) ?? 0;
  const dOff = airportUtcOffsetMin(dIata) ?? 0;

  const km = greatCircleKm(oIata, dIata) ?? 2500;
  const durMs = Math.round((km / 800 + 0.6) * 3600_000);

  // Local calendar day of `nowMs`, for the today / future / past decision.
  const n = new Date(nowMs);
  const todayISO = `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;

  const base: Omit<FlightStatus, 'status' | 'origin' | 'destination'> = {
    ident: id,
    airline: { iata: id.slice(0, 2), name: r.airline ?? 'JetSetter Airways' },
    date,
    aircraft: { model: h % 2 === 0 ? 'Boeing 787-9' : 'Airbus A321neo' },
    position: null,
    source: 'sample',
    fetchedAt: isoWithOffset(nowMs, 0),
    stale: false,
  };

  const endpoint = (
    iata: string,
    offset: number,
    times: { scheduled: number; estimated?: number; actual?: number },
    arrival: boolean,
  ) => ({
    iata,
    city: airportCity(iata),
    terminal: arrival ? '2' : '4',
    gate: arrival ? `C${(h % 20) + 1}` : `B${(h % 24) + 1}`,
    baggageClaim: arrival ? String((h % 9) + 1) : undefined,
    times: {
      scheduled: isoWithOffset(times.scheduled, offset),
      estimated: times.estimated != null ? isoWithOffset(times.estimated, offset) : undefined,
      actual: times.actual != null ? isoWithOffset(times.actual, offset) : undefined,
    },
  });

  if (date === todayISO) {
    // Enroute: anchored to the top of the hour so the demo plane creeps along.
    const hourFloor = nowMs - (nowMs % 3600_000);
    const dep = hourFloor - Math.round(durMs * 0.4);
    const arr = dep + durMs;
    return {
      ...base,
      status: 'enroute',
      origin: endpoint(oIata, oOff, { scheduled: dep, estimated: dep, actual: dep }, false),
      destination: endpoint(dIata, dOff, { scheduled: arr, estimated: arr }, true),
    };
  }

  // Scheduled 10:00 airport-local on the given date (delayed for some idents).
  const depUtc = Date.parse(`${date}T10:00:00Z`) - oOff * 60_000;
  const arrUtc = depUtc + durMs;
  if (date < todayISO) {
    return {
      ...base,
      status: 'landed',
      origin: endpoint(oIata, oOff, { scheduled: depUtc, actual: depUtc }, false),
      destination: endpoint(dIata, dOff, { scheduled: arrUtc, actual: arrUtc }, true),
    };
  }
  const delayed = h % 4 === 1;
  const delayMin = delayed ? 35 : undefined;
  const est = delayed ? depUtc + 35 * 60_000 : undefined;
  return {
    ...base,
    status: delayed ? 'delayed' : 'scheduled',
    delayMin,
    origin: endpoint(oIata, oOff, { scheduled: depUtc, estimated: est }, false),
    destination: endpoint(
      dIata,
      dOff,
      { scheduled: arrUtc, estimated: delayed ? arrUtc + 35 * 60_000 : undefined },
      true,
    ),
  };
}
