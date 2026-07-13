// Pure flight-progress helpers (extracted from the In-Flight screen so they can
// be unit-tested). The values are estimates for display only.

/** Origin/dest IATA codes parsed from an itinerary title like "JFK → LAX". */
export function parseRoute(title: string): { origin: string; dest: string } {
  const m = title.match(/([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})/i);
  return m ? { origin: m[1].toUpperCase(), dest: m[2].toUpperCase() } : { origin: '', dest: '' };
}

export interface FlightPhase {
  label: string;
  alt: number;
}

/** Estimated phase + altitude (ft) for a flight `progress` in [0, 1]. Altitude is
 *  monotonic: climbs to 35000 ft cruise, then descends 35000 → 5000 → 0. */
export function phaseOf(p: number): FlightPhase {
  if (p < 0.06) return { label: 'Taxi & Takeoff', alt: Math.round((p / 0.06) * 10000) };
  if (p < 0.22) return { label: 'Climb', alt: Math.round(10000 + ((p - 0.06) / 0.16) * 25000) };
  if (p < 0.8) return { label: 'Cruise', alt: 35000 };
  if (p < 0.95) return { label: 'Descent', alt: Math.round(35000 - 30000 * ((p - 0.8) / 0.15)) };
  // Math.max guards against a tiny negative (and -0) from float rounding at p≈1.
  return { label: 'Final approach', alt: Math.max(0, Math.round(5000 * (1 - (p - 0.95) / 0.05))) };
}
