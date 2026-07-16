// Security-wait estimation — clearly labeled heuristic. There is no reliable
// free TSA feed (the MyTSA wait-time data stopped updating), so the departure
// optimizer estimates from airport tier × day/hour curve × lane multiplier.
// The seam: replace `estimateSecurityWait` internals with an `op=tsa` backend
// call when a live source exists.

export type SecurityLane = 'standard' | 'preCheck' | 'clear';

export interface WaitEstimate {
  minutes: number;
  range: [number, number];
  peak: boolean;
  confidence: 'estimate';
}

// Mega/large US + major international hubs get the highest base wait.
const MEGA_HUBS = new Set([
  'ATL', 'LAX', 'ORD', 'DFW', 'DEN', 'JFK', 'SFO', 'SEA', 'LAS', 'MCO',
  'EWR', 'MIA', 'PHX', 'IAH', 'BOS', 'FLL', 'MSP', 'LGA', 'DTW', 'PHL',
  'CLT', 'SLC', 'BWI', 'SAN', 'IAD', 'TPA', 'LHR', 'CDG', 'FRA', 'AMS',
  'HND', 'NRT', 'DXB', 'SIN', 'ICN', 'YYZ',
]);
const MID_HUBS = new Set([
  'DCA', 'AUS', 'BNA', 'DAL', 'HOU', 'MDW', 'OAK', 'MSY', 'RDU', 'SJC',
  'SMF', 'SNA', 'STL', 'PDX', 'HNL', 'PIT', 'CVG', 'CMH', 'IND', 'MCI',
]);

const LANE_FACTOR: Record<SecurityLane, number> = {
  standard: 1,
  preCheck: 0.4,
  clear: 0.25,
};

/** Peak curves: early-morning (05–08) and after-work (15–19) local. */
function hourFactor(hour: number): { factor: number; peak: boolean } {
  if (hour >= 5 && hour < 8) return { factor: 1.35, peak: true };
  if (hour >= 15 && hour < 19) return { factor: 1.25, peak: true };
  if (hour >= 8 && hour < 11) return { factor: 1.1, peak: false };
  if (hour >= 22 || hour < 4) return { factor: 0.55, peak: false };
  return { factor: 1, peak: false };
}

export function estimateSecurityWait(
  airportIata: string | undefined,
  when: Date,
  lane: SecurityLane,
): WaitEstimate {
  const code = (airportIata ?? '').toUpperCase();
  const base = MEGA_HUBS.has(code) ? 28 : MID_HUBS.has(code) ? 18 : 12;
  const day = when.getDay();
  const weekendFactor = day === 0 || day === 5 ? 1.15 : day === 6 ? 0.9 : 1;
  const { factor, peak } = hourFactor(when.getHours());
  const minutes = Math.max(3, Math.round(base * factor * weekendFactor * LANE_FACTOR[lane]));
  const spread = Math.max(2, Math.round(minutes * 0.35));
  return {
    minutes,
    range: [Math.max(2, minutes - spread), minutes + spread],
    peak,
    confidence: 'estimate',
  };
}
