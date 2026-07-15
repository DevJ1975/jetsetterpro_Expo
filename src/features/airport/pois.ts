// Airport-map data synthesis: terminal POIs, a gate-side anchor point, and an
// "indoor preview" wayfinding polyline.
//
// There is no indoor-map (IMDF) provider wired in yet, so — like the iOS
// AirportMapViewModel, which falls back to terminal/centroid approximations —
// everything here is an approximation layered on the airport's published
// coordinate. Every value derives from a seeded hash of the IATA code: the same
// airport always renders the same layout, and no Math.random()/Date.now() runs
// during render (React Compiler lint forbids impure calls there).

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type PoiKind = 'restaurant' | 'cafe' | 'lounge' | 'gate' | 'transit' | 'restroom';

export interface AirportPoi {
  id: string;
  kind: PoiKind;
  name: string;
  /** Short placement line, e.g. "Concourse B · Airside". */
  detail: string;
  coordinate: LatLng;
}

export interface AirportMapModel {
  pois: AirportPoi[];
  /** Gate-side point the wayfinding route terminates at. */
  gatePoint: LatLng;
}

// ── Seeded pseudo-random ─────────────────────────────────────────────────────

/** FNV-1a 32-bit hash of a string → unsigned int seed. */
export function seededHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic unit float in [0, 1) for a (seed, lane) pair (mulberry-style mix). */
export function seededUnit(seed: number, lane: number): number {
  let t = (seed + Math.imul(lane + 1, 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── Geo helpers ──────────────────────────────────────────────────────────────

const METERS_PER_DEG_LAT = 111_320;

/** Offset a coordinate by metres east/north (small-distance approximation). */
export function offsetMeters(origin: LatLng, eastM: number, northM: number): LatLng {
  const cosLat = Math.cos((origin.latitude * Math.PI) / 180) || 1e-6;
  return {
    latitude: origin.latitude + northM / METERS_PER_DEG_LAT,
    longitude: origin.longitude + eastM / (METERS_PER_DEG_LAT * cosLat),
  };
}

/** Haversine distance between two coordinates, in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(s));
}

/** Terminal walking pace used for every ETA on this screen. */
export const WALK_SPEED_KM_H = 5;

/** Walk ETA in whole minutes at WALK_SPEED_KM_H (never less than 1). */
export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / ((WALK_SPEED_KM_H * 1000) / 60)));
}

/** "480 m" under a kilometre, "1.2 km" above. */
export function formatWalkDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.max(10, Math.round(distanceM / 10) * 10)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

// ── Gate labels ──────────────────────────────────────────────────────────────

/** Pull a gate label out of itinerary text ("Gate B22", or a bare "B22"). */
export function gateFromText(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/gate\s*([A-Z]{0,2}\s?-?\d{1,3}[A-Z]?)/i);
  if (m) return m[1].replace(/[\s-]+/g, '').toUpperCase();
  const bare = text.trim().toUpperCase();
  if (/^[A-Z]{1,2}\d{1,3}[A-Z]?$/.test(bare)) return bare;
  return null;
}

const CONCOURSE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Deterministic placeholder gate ("B14") when neither live status nor the
 *  itinerary carries one. */
export function fallbackGate(iata: string): string {
  const seed = seededHash(iata.toUpperCase());
  const letter = CONCOURSE_LETTERS[Math.floor(seededUnit(seed, 0) * CONCOURSE_LETTERS.length)];
  const num = 2 + Math.floor(seededUnit(seed, 4) * 38);
  return `${letter}${num}`;
}

// ── POI synthesis ────────────────────────────────────────────────────────────

const RESTAURANT_NAMES = [
  'The Runway Grill',
  'Altitude Kitchen',
  'Meridian Provisions',
  'Tarmac Taqueria',
  'First Light Diner',
  'Jet & Vine',
];
const CAFE_NAMES = [
  'Cloud Nine Coffee',
  'Daily Departure Café',
  'Mach One Espresso',
  'Terminal Grounds',
];
const LOUNGE_NAMES = ['Aurora Premier Lounge', 'The Meridian Club', 'Skyline Executive Lounge'];

function pickName(pool: readonly string[], seed: number, lane: number, i: number): string {
  const start = Math.floor(seededUnit(seed, lane) * pool.length);
  return pool[(start + i) % pool.length];
}

/**
 * Deterministic terminal layout for an airport: a gate cluster along a hashed
 * "terminal axis" bearing, amenities fanned around it, transit on the landside.
 * `gate` (e.g. "B22") names the wayfinding gate marker.
 */
export function buildAirportModel(iata: string, center: LatLng, gate: string): AirportMapModel {
  const code = iata.toUpperCase();
  const seed = seededHash(code);

  const gateLabel = gate.toUpperCase();
  const letter =
    gateLabel.match(/^([A-Z])/)?.[1] ??
    CONCOURSE_LETTERS[Math.floor(seededUnit(seed, 0) * CONCOURSE_LETTERS.length)];
  const gateNum = parseInt(gateLabel.match(/(\d{1,3})/)?.[1] ?? '', 10) || 12;

  // Terminal axis: the bearing from the airport centre the concourse runs along.
  const axis = seededUnit(seed, 1) * Math.PI * 2;
  const perp = axis + Math.PI / 2;
  const place = (angle: number, radiusM: number): LatLng =>
    offsetMeters(center, Math.cos(angle) * radiusM, Math.sin(angle) * radiusM);

  const gatePoint = place(axis, 620);
  const airside = `Concourse ${letter} · Airside`;
  const pois: AirportPoi[] = [];

  // Gates cluster — the traveller's gate plus two concourse neighbours.
  pois.push({
    id: 'gate-anchor',
    kind: 'gate',
    name: `Gate ${gateLabel}`,
    detail: airside,
    coordinate: gatePoint,
  });
  const n1 = gateNum > 2 ? gateNum - 2 : gateNum + 4;
  const n2 = gateNum + 2;
  pois.push({
    id: 'gate-n1',
    kind: 'gate',
    name: `Gate ${letter}${n1}`,
    detail: airside,
    coordinate: offsetMeters(gatePoint, Math.cos(perp) * 75, Math.sin(perp) * 75),
  });
  pois.push({
    id: 'gate-n2',
    kind: 'gate',
    name: `Gate ${letter}${n2}`,
    detail: airside,
    coordinate: offsetMeters(gatePoint, Math.cos(perp) * -75, Math.sin(perp) * -75),
  });

  // 3 restaurants — fanned around the mid-terminal.
  for (let i = 0; i < 3; i += 1) {
    pois.push({
      id: `restaurant-${i}`,
      kind: 'restaurant',
      name: pickName(RESTAURANT_NAMES, seed, 2, i),
      detail: airside,
      coordinate: place(
        axis + (seededUnit(seed, 10 + i) - 0.5) * 1.7,
        240 + seededUnit(seed, 13 + i) * 320,
      ),
    });
  }

  // 2 cafés.
  for (let i = 0; i < 2; i += 1) {
    pois.push({
      id: `cafe-${i}`,
      kind: 'cafe',
      name: pickName(CAFE_NAMES, seed, 3, i),
      detail: airside,
      coordinate: place(
        axis + (seededUnit(seed, 16 + i) - 0.5) * 2.1,
        260 + seededUnit(seed, 18 + i) * 280,
      ),
    });
  }

  // 1 lounge — close to the gates.
  pois.push({
    id: 'lounge-0',
    kind: 'lounge',
    name: pickName(LOUNGE_NAMES, seed, 5, 0),
    detail: airside,
    coordinate: place(axis + (seededUnit(seed, 21) - 0.5) * 0.6, 460 + seededUnit(seed, 22) * 130),
  });

  // 2 restrooms — one near the gates, one mid-concourse.
  pois.push({
    id: 'restroom-0',
    kind: 'restroom',
    name: 'Restrooms',
    detail: `Near Gate ${letter}${n1}`,
    coordinate: place(axis + 0.12, 470),
  });
  pois.push({
    id: 'restroom-1',
    kind: 'restroom',
    name: 'Restrooms',
    detail: `Concourse ${letter}`,
    coordinate: place(axis - 0.3, 290),
  });

  // Transit — landside, opposite the concourse.
  pois.push({
    id: 'transit-0',
    kind: 'transit',
    name: 'Airport Transit Center',
    detail: 'Landside · Rail & shuttle',
    coordinate: place(axis + Math.PI, 430),
  });

  return { pois, gatePoint };
}

// ── Wayfinding polyline ──────────────────────────────────────────────────────

/**
 * Synthetic corridor route: start → two dog-leg waypoints → destination. The
 * lateral offsets are seeded so a given route always draws the same preview.
 */
export function buildIndoorRoute(start: LatLng, end: LatLng, seed: number): LatLng[] {
  const cosLat = Math.cos((start.latitude * Math.PI) / 180) || 1e-6;
  const eastM = (end.longitude - start.longitude) * METERS_PER_DEG_LAT * cosLat;
  const northM = (end.latitude - start.latitude) * METERS_PER_DEG_LAT;
  const len = Math.hypot(eastM, northM) || 1;
  // Unit vector perpendicular to the straight line, for corridor doglegs.
  const perpE = -northM / len;
  const perpN = eastM / len;
  const side = seededUnit(seed, 0) > 0.5 ? 1 : -1;
  const swing1 = (40 + seededUnit(seed, 1) * 55) * side;
  const swing2 = -(22 + seededUnit(seed, 2) * 38) * side;

  const at = (f: number, lateralM: number): LatLng => ({
    latitude: start.latitude + (northM * f + perpN * lateralM) / METERS_PER_DEG_LAT,
    longitude: start.longitude + (eastM * f + perpE * lateralM) / (METERS_PER_DEG_LAT * cosLat),
  });

  return [start, at(0.35, swing1), at(0.72, swing2), end];
}

/** Total polyline length in metres. */
export function routeDistanceM(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineM(points[i - 1], points[i]);
  return total;
}
