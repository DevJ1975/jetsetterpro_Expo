// Flight-status derivation. The iOS Flight Tracker pulls from FlightAware
// (a keyed API that, per the security plan, routes through a Cloud Function).
// Until that backend is wired, we derive a faithful status from the traveler's
// own itinerary (times, route, gate) — the same demo-first posture the rest of
// the app uses. Swapping in live data later means replacing `deriveFlight`'s
// body with a fetch; the shape below already mirrors the ActivityKit content.

import type { ItineraryItem } from '@/src/types/models';
import type { FlightActivityContent } from '@/src/core/services/liveActivity';

export type FlightStatusLabel = 'Scheduled' | 'Boarding' | 'Departed' | 'Landed';

export interface DerivedFlight {
  flightNumber: string;
  origin: string; // IATA
  destination: string; // IATA
  status: FlightStatusLabel;
  phase: string;
  altitudeFt: number;
  gate?: string;
  departISO: string;
  arriveISO?: string;
  progress: number; // 0..1
  delayMin: number;
}

export function parseRoute(title: string): { origin: string; dest: string } {
  const m = title.match(/([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})/i);
  return m ? { origin: m[1].toUpperCase(), dest: m[2].toUpperCase() } : { origin: '', dest: '' };
}

/** Best-effort flight-number token from an itinerary title (e.g. "AA 100"). */
export function parseFlightNumber(item: ItineraryItem): string {
  const m = item.title.match(/\b([A-Z]{2}\s?\d{1,4})\b/);
  if (m) return m[1].replace(/\s/g, '').toUpperCase();
  return item.confirmation?.toUpperCase() ?? 'FLIGHT';
}

export function flightPhase(progress: number): { label: string; altFt: number } {
  if (progress <= 0) return { label: 'On the ground', altFt: 0 };
  if (progress < 0.06) return { label: 'Taxi & takeoff', altFt: Math.round((progress / 0.06) * 10000) };
  if (progress < 0.22) return { label: 'Climb', altFt: Math.round(10000 + ((progress - 0.06) / 0.16) * 25000) };
  if (progress < 0.8) return { label: 'Cruise', altFt: 35000 };
  if (progress < 0.95) return { label: 'Descent', altFt: Math.round(35000 * (1 - (progress - 0.8) / 0.15)) };
  if (progress < 1) return { label: 'Final approach', altFt: Math.round(5000 * (1 - (progress - 0.95) / 0.05)) };
  return { label: 'Landed', altFt: 0 };
}

const BOARDING_LEAD_MS = 45 * 60_000;

export function deriveFlight(item: ItineraryItem, now: Date = new Date()): DerivedFlight {
  const { origin, dest } = parseRoute(item.title);
  const start = new Date(item.startDate).getTime();
  const end = item.endDate ? new Date(item.endDate).getTime() : start + 2 * 3600_000;
  const t = now.getTime();

  let progress = 0;
  let status: FlightStatusLabel;
  if (t < start - BOARDING_LEAD_MS) status = 'Scheduled';
  else if (t < start) status = 'Boarding';
  else if (t <= end) {
    status = 'Departed';
    progress = Math.max(0, Math.min(1, (t - start) / (end - start)));
  } else {
    status = 'Landed';
    progress = 1;
  }

  const phase = flightPhase(progress);
  return {
    flightNumber: parseFlightNumber(item),
    origin,
    destination: dest,
    status,
    phase: phase.label,
    altitudeFt: phase.altFt,
    gate: item.location || undefined,
    departISO: item.startDate,
    arriveISO: item.endDate,
    progress,
    delayMin: 0,
  };
}

/** Map a derived flight into the Live Activity content payload. */
export function toActivityContent(f: DerivedFlight): FlightActivityContent {
  return {
    flightNumber: f.flightNumber,
    origin: f.origin,
    destination: f.destination,
    status: f.status,
    gate: f.gate,
    departISO: f.departISO,
    arriveISO: f.arriveISO,
    progress: f.progress,
  };
}
