// Departure-board data — modeled on the iOS `FlightBoardData.swift`. Merges
// the user's real upcoming flights (highlighted, live-status capable) into a
// deterministic set of illustrative sample departures whose times are pinned
// relative to the moment the board is built. Statuses are NOT stored: they
// re-derive from each row's fixed departure instant against a ticking clock,
// so the board behaves live (ON TIME → BOARDING → FINAL CALL → DEPARTED →
// retired) without regenerating the schedule.

import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import type { FlightStatusCode } from '@/src/core/api/flights';
import { parseRoute } from '@/src/core/flightPhase';
import type { Trip } from '@/src/types/models';
import { localHHmm } from './util';

export type BoardStatusLabel =
  | 'ON TIME'
  | 'BOARDING'
  | 'FINAL CALL'
  | 'DELAYED'
  | 'DEPARTED'
  | 'CANCELLED'
  | 'DIVERTED';

export interface BoardRow {
  key: string;
  flightNumber: string;
  dest: string; // IATA
  timeLabel: string; // HH:mm (device-local)
  gate: string;
  terminal: string; // '' when unknown — surfaces only under ALL
  depMs: number;
  /** Editorial state not driven by the clock (sample "delayed" rows). */
  editorial?: 'DELAYED';
  isUser: boolean;
  ident?: string; // user rows — live status lookup
  date?: string; // YYYY-MM-DD
}

/** Solari palette per status (spec: board status colors). */
export const BOARD_STATUS_COLORS: Record<BoardStatusLabel, string> = {
  'ON TIME': '#1DB97D',
  BOARDING: '#E8A020',
  'FINAL CALL': '#FFD60A',
  DELAYED: '#FF5C5C',
  DEPARTED: 'rgba(255,255,255,0.35)',
  CANCELLED: '#FF5C5C',
  DIVERTED: '#FF5C5C',
};

// Curated sample departures (flight, dest, minutes-from-now, gate, terminal),
// straight from the iOS dataset. DL400 is editorially delayed.
const SAMPLE_TEMPLATES: [string, string, number, string, string, boolean?][] = [
  ['UA837', 'LHR', 18, 'C14', '3'],
  ['AF023', 'CDG', 45, 'B22', '1'],
  ['LH441', 'FRA', 62, 'A7', '1'],
  ['DL400', 'AMS', 80, 'B18', '2', true],
  ['BA178', 'MAD', 95, 'C9', '3'],
  ['EK202', 'DXB', 110, 'A12', '1'],
  ['AA169', 'GRU', 125, 'D4', '4'],
  ['SQ026', 'SIN', 140, 'A18', '1'],
];

function sampleRows(nowMs: number): BoardRow[] {
  return SAMPLE_TEMPLATES.map(([flight, dest, minutes, gate, terminal, delayed]) => {
    const depMs = nowMs + minutes * 60_000;
    return {
      key: `sample-${flight}`,
      flightNumber: flight,
      dest,
      timeLabel: localHHmm(depMs),
      gate,
      terminal,
      depMs,
      editorial: delayed ? ('DELAYED' as const) : undefined,
      isUser: false,
    };
  });
}

/** Last standalone 3-letter uppercase token — a plausible IATA code. */
function iataToken(text?: string): string | null {
  if (!text) return null;
  const matches = text.match(/\b[A-Z]{3}\b/g);
  return matches ? matches[matches.length - 1] : null;
}

function extractGate(item: { location?: string; notes?: string }): string {
  const src = `${item.location ?? ''} ${item.notes ?? ''}`;
  const m = src.match(/gate\s*([A-Z]?\d+[A-Z]?)/i);
  return m ? m[1].toUpperCase() : 'TBD';
}

/** Terminal from the notes, or inferred from a lettered gate (C14 → C) —
 *  never guessed, so unknown terminals ('') only surface under ALL. */
function extractTerminal(item: { location?: string; notes?: string }, gate: string): string {
  const src = `${item.location ?? ''} ${item.notes ?? ''}`;
  const m = src.match(/terminal\s*([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  const first = gate.charAt(0);
  return /[A-Z]/.test(first) && gate !== 'TBD' ? first : '';
}

/** The user's own upcoming flights within the board's realistic horizon
 *  (next 18h — a "today's departures" board can't honestly show next week). */
function userRows(trips: Trip[], nowMs: number): BoardRow[] {
  const horizon = nowMs + 18 * 3600_000;
  return trips
    .flatMap((t) => t.items)
    .filter((i) => i.type === 'flight')
    .map((i) => ({ item: i, depMs: Date.parse(i.startDate) }))
    .filter(({ depMs }) => Number.isFinite(depMs) && depMs > nowMs - 10 * 60_000 && depMs < horizon)
    .map(({ item, depMs }) => {
      const ident = extractFlightNumber(item.title) ?? undefined;
      const route = parseRoute(item.title);
      const gate = extractGate(item);
      return {
        key: `user-${item.id}`,
        flightNumber: ident ?? item.title.slice(0, 6).toUpperCase(),
        dest: route.dest || iataToken(item.location) || '-',
        timeLabel: localHHmm(depMs),
        gate,
        terminal: extractTerminal(item, gate),
        depMs,
        isUser: true,
        ident,
        date: item.startDate.slice(0, 10),
      };
    });
}

/** Full board for "now": samples + user flights, chronologically merged. */
export function buildBoardRows(trips: Trip[], nowMs: number): BoardRow[] {
  return [...sampleRows(nowMs), ...userRows(trips, nowMs)].sort((a, b) => a.depMs - b.depMs);
}

function fromApi(code: FlightStatusCode): BoardStatusLabel | null {
  switch (code) {
    case 'boarding':
      return 'BOARDING';
    case 'delayed':
      return 'DELAYED';
    case 'departed':
    case 'enroute':
    case 'landed':
    case 'arrived':
      return 'DEPARTED';
    case 'cancelled':
      return 'CANCELLED';
    case 'diverted':
      return 'DIVERTED';
    default:
      return null; // scheduled/unknown → clock-derived
  }
}

/** Live status for a row at `nowMs` — null retires the row (departed >10m ago).
 *  Order: retirement, then live API state (user rows), then editorial states,
 *  then the clock thresholds: BOARDING ≤40m, FINAL CALL ≤15m, DEPARTED past. */
export function boardStatus(
  row: BoardRow,
  nowMs: number,
  liveCode?: FlightStatusCode,
): BoardStatusLabel | null {
  const minutesAway = (row.depMs - nowMs) / 60_000;
  if (minutesAway <= -10) return null;
  if (liveCode) {
    const mapped = fromApi(liveCode);
    if (mapped) return mapped;
  }
  if (row.editorial) return row.editorial;
  if (minutesAway < 0) return 'DEPARTED';
  if (minutesAway <= 15) return 'FINAL CALL';
  if (minutesAway <= 40) return 'BOARDING';
  return 'ON TIME';
}
