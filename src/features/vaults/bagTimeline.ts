// Scan-timeline derivation for the bag detail screen — the RN analog of the
// iOS `Bag.scanHistory` (Features/LuggageTracker/*). We don't have a live
// WorldTracer feed, so node timestamps are derived deterministically from the
// bag id (seeded hash) anchored to the bag's last update — stable across
// renders and app launches (react-compiler forbids Date.now()/Math.random()
// in render).

import { rngFor } from '@/src/features/checkin/flightHash';
import type { Bag, BagStatus } from '@/src/core/store/luggage';

export interface TimelineNode {
  key: string;
  title: string;
  icon: string;
  color: string;
  location: string;
  /** Reached nodes carry a timestamp; future nodes are dim + timeless. */
  reachedAt?: Date;
  reached: boolean;
}

const NODES: { key: string; title: string; icon: string; color: string }[] = [
  { key: 'checked', title: 'Checked', icon: 'checkmark-circle', color: '#3E8DE8' },
  { key: 'security', title: 'Security', icon: 'shield-checkmark', color: '#5BBAFF' },
  { key: 'loaded', title: 'Loaded', icon: 'arrow-up-circle', color: '#9B6CF0' },
  { key: 'transit', title: 'In transit', icon: 'airplane', color: '#3B9EF0' },
  { key: 'arrived', title: 'Arrived', icon: 'checkmark-done-circle', color: '#1DB97D' },
  { key: 'carousel', title: 'At carousel', icon: 'sync-circle', color: '#0A9E6C' },
];

/** Highest timeline index a status has reached (missing/delayed freeze mid-journey). */
export function reachedIndex(status: BagStatus): number {
  switch (status) {
    case 'checked':
      return 1; // bag drop + security screening happen minutes apart
    case 'loaded':
      return 2;
    case 'inTransit':
      return 3;
    case 'arrived':
      return 4;
    case 'delivered':
      return 5;
    case 'delayed':
      return 2;
    case 'missing':
    case 'lost':
      return 3;
  }
}

/** Deterministic location strings, seasoned per bag (carousel/gate numbers). */
function locations(bag: Bag): string[] {
  const r = rngFor(bag.id, 'bag-locations');
  const terminal = 'ABCDE'[Math.floor(r() * 5)];
  const gate = 1 + Math.floor(r() * 40);
  const carousel = 1 + Math.floor(r() * 9);
  const flight = bag.flightNumber ? ` · ${bag.flightNumber}` : '';
  return [
    `Bag drop — Terminal ${terminal}`,
    'Baggage screening (TSA)',
    `Loader dock — Gate ${terminal}${gate}`,
    `In flight${flight}`,
    bag.lastLocation ?? 'Arrival airport',
    `Carousel ${carousel}`,
  ];
}

/**
 * Build the six-node timeline. The LAST reached node lands on the bag's
 * `updatedAt` (its most recent scan); earlier nodes walk backwards through
 * seeded 18–55 minute gaps so the history looks organic but never shifts.
 */
export function buildTimeline(bag: Bag): TimelineNode[] {
  const reached = reachedIndex(bag.status);
  const anchor = new Date(bag.updatedAt).getTime();
  const gapRng = rngFor(bag.id, 'bag-gaps');
  const gaps = NODES.map(() => (18 + gapRng() * 37) * 60_000); // 18–55 min

  // Cumulative offset of each node BACK from the anchor (last reached = 0).
  const locs = locations(bag);
  return NODES.map((node, i) => {
    const isReached = i <= reached;
    let reachedAt: Date | undefined;
    if (isReached) {
      let back = 0;
      for (let j = i; j < reached; j++) back += gaps[j + 1] ?? 30 * 60_000;
      reachedAt = new Date(anchor - back);
    }
    return { ...node, location: locs[i], reached: isReached, reachedAt };
  });
}
