// Local Experience Engine data layer — Overpass (OpenStreetMap) POIs bucketed
// into the iOS LocalExperienceView time slots (RIGHT NOW / TONIGHT / THIS
// TRIP). Follows the conventions of src/core/api/places.ts (same endpoint,
// keyless posture) but keeps each POI's `opening_hours` tag so cards can show
// an Open badge when the hours are actually known.

import { useQuery } from '@tanstack/react-query';
import { geocodeCity } from '@/src/core/api/weather';

export type ExperienceCategory = 'cafe' | 'restaurant' | 'bar' | 'attraction';

export interface Experience {
  id: string;
  name: string;
  /** Short human label, e.g. "Restaurant · Sushi". */
  kind: string;
  category: ExperienceCategory;
  lat: number;
  lon: number;
  distanceM: number;
  /** Raw OSM opening_hours tag when present — evaluate with `isOpenNow`. */
  openingHours?: string;
}

export interface ExperienceSections {
  rightNow: Experience[];
  tonight: Experience[];
  thisTrip: Experience[];
}

/** Category display meta (icons are Ionicons; colors from the iOS
 *  ExperienceCategory palette). */
export const EXPERIENCE_META: Record<
  ExperienceCategory,
  { label: string; icon: string; color: string }
> = {
  cafe: { label: 'Café', icon: 'cafe', color: '#1DB97D' },
  restaurant: { label: 'Restaurant', icon: 'restaurant', color: '#E84040' },
  bar: { label: 'Bar', icon: 'wine', color: '#C8860A' },
  attraction: { label: 'Attraction', icon: 'camera', color: '#3B9EF0' },
};

// ── Overpass fetch ────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 2500;
const SECTION_CAP = 8;

const TAG_CATEGORY: [key: string, value: string, category: ExperienceCategory][] = [
  ['amenity', 'cafe', 'cafe'],
  ['amenity', 'restaurant', 'restaurant'],
  ['amenity', 'fast_food', 'restaurant'],
  ['amenity', 'bar', 'bar'],
  ['amenity', 'pub', 'bar'],
  ['amenity', 'nightclub', 'bar'],
  ['tourism', 'attraction', 'attraction'],
  ['tourism', 'museum', 'attraction'],
  ['tourism', 'gallery', 'attraction'],
  ['tourism', 'artwork', 'attraction'],
  ['historic', 'monument', 'attraction'],
];

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function categoryFor(tags: Record<string, string>): ExperienceCategory | null {
  for (const [k, v, category] of TAG_CATEGORY) {
    if (tags[k] === v) return category;
  }
  return null;
}

/** Human label, e.g. "Restaurant · Sushi" (same shape as places.ts). */
function labelFor(tags: Record<string, string>): string {
  const primary = tags.amenity ?? tags.tourism ?? tags.historic ?? 'Place';
  const nice = primary.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  const detail = tags.cuisine?.split(';')[0]?.replace(/_/g, ' ');
  return detail ? `${nice} · ${detail.replace(/\b\w/g, (ch) => ch.toUpperCase())}` : nice;
}

function buildQuery(lat: number, lon: number): string {
  const clauses = TAG_CATEGORY.map(
    ([k, v]) => `node(around:${RADIUS_M},${lat},${lon})["${k}"="${v}"]["name"];`,
  ).join('');
  return `[out:json][timeout:20];(${clauses});out body 200;`;
}

export async function fetchExperiences(lat: number, lon: number): Promise<Experience[]> {
  const r = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildQuery(lat, lon))}`,
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = (await r.json()) as { elements?: OverpassElement[] };

  const candidates: Experience[] = [];
  for (const el of j.elements ?? []) {
    const name = el.tags?.name;
    if (!name || el.lat == null || el.lon == null) continue;
    const category = categoryFor(el.tags ?? {});
    if (!category) continue;
    candidates.push({
      id: String(el.id),
      name,
      kind: labelFor(el.tags ?? {}),
      category,
      lat: el.lat,
      lon: el.lon,
      distanceM: Math.round(haversineM(lat, lon, el.lat, el.lon)),
      openingHours: el.tags?.opening_hours,
    });
  }

  // Nearest-first, then de-dupe same-named chains keeping the closest branch.
  candidates.sort((a, b) => a.distanceM - b.distanceM);
  const seen = new Set<string>();
  const out: Experience[] = [];
  for (const p of candidates) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
  }
  return out;
}

/** Buckets POIs into the iOS time slots. RIGHT NOW: cafés + food nearby;
 *  TONIGHT: bars + (remaining) restaurants; THIS TRIP: attractions/museums.
 *  Each place appears in at most one section, nearest-first. Pure. */
export function sectionExperiences(all: Experience[]): ExperienceSections {
  const byDistance = [...all].sort((a, b) => a.distanceM - b.distanceM);
  const used = new Set<string>();
  const take = (pred: (p: Experience) => boolean): Experience[] => {
    const out: Experience[] = [];
    for (const p of byDistance) {
      if (used.has(p.id) || !pred(p)) continue;
      out.push(p);
      used.add(p.id);
      if (out.length >= SECTION_CAP) break;
    }
    return out;
  };
  return {
    rightNow: take((p) => p.category === 'cafe' || p.category === 'restaurant'),
    tonight: take((p) => p.category === 'bar' || p.category === 'restaurant'),
    thisTrip: take((p) => p.category === 'attraction'),
  };
}

// ── opening_hours evaluation ─────────────────────────────────────────────────

const DAY_IDX: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

function parseDays(part: string): Set<number> | null {
  const days = new Set<number>();
  for (const token of part.split(',')) {
    const t = token.trim().toLowerCase();
    if (!t) continue;
    const range = t.split('-');
    if (range.length === 1) {
      const d = DAY_IDX[range[0]];
      if (d == null) return null;
      days.add(d);
    } else if (range.length === 2) {
      const from = DAY_IDX[range[0]];
      const to = DAY_IDX[range[1]];
      if (from == null || to == null) return null;
      // Wrap-aware range (e.g. "Sa-Mo").
      for (let i = from, guard = 0; guard < 7; i = (i + 1) % 7, guard += 1) {
        days.add(i);
        if (i === to) break;
      }
    } else {
      return null;
    }
  }
  return days.size ? days : null;
}

function toMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const RULE_RE =
  /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(off|closed|(?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i;

/**
 * Conservative OSM `opening_hours` evaluation: handles "24/7" and the common
 * "Days HH:MM-HH:MM[,HH:MM-HH:MM]" rule shapes (incl. overnight spans and
 * "off"/"closed" overrides). Returns `undefined` for anything it can't parse
 * with confidence — the caller omits the Open badge rather than guessing.
 * Pure given (tag, date).
 */
export function isOpenNow(openingHours: string | undefined, at: Date): boolean | undefined {
  const oh = openingHours?.trim();
  if (!oh) return undefined;
  if (oh === '24/7') return true;

  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();
  let coveredToday = false;
  let openToday = false;

  for (const raw of oh.split(';')) {
    const rule = raw.trim();
    if (!rule) continue;
    // Public/school-holiday rules can't be evaluated without a calendar — skip.
    if (/^(PH|SH)\b/i.test(rule)) continue;

    const m = rule.match(RULE_RE);
    if (!m) return undefined;
    const [, daysPart, body] = m;
    const days = daysPart ? parseDays(daysPart) : ALL_DAYS;
    if (!days) return undefined;
    if (!days.has(day)) continue;

    coveredToday = true;
    if (/^(off|closed)$/i.test(body.trim())) {
      openToday = false; // later rules override earlier ones
      continue;
    }
    let withinAny = false;
    for (const span of body.split(',')) {
      const [startRaw, endRaw] = span.split('-').map((s) => s.trim());
      const start = toMinutes(startRaw);
      const end = endRaw === '24:00' ? 24 * 60 : toMinutes(endRaw);
      if (start == null || end == null) return undefined;
      const within =
        end > start
          ? minutes >= start && minutes < end
          : minutes >= start || minutes < end; // overnight, e.g. 22:00-02:00
      if (within) withinAny = true;
    }
    openToday = withinAny;
  }

  return coveredToday ? openToday : false;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export interface LatLon {
  lat: number;
  lon: number;
}

/** Geocode a free-text city ("Tokyo, Japan") to coordinates via Open-Meteo. */
export function useCityCoords(city?: string) {
  return useQuery({
    queryKey: ['experiences-geocode', city],
    queryFn: () => geocodeCity(city as string),
    enabled: !!city?.trim(),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useExperiences(coords: LatLon | null | undefined) {
  return useQuery({
    queryKey: ['experiences', coords?.lat, coords?.lon],
    queryFn: () => fetchExperiences((coords as LatLon).lat, (coords as LatLon).lon),
    enabled: coords != null,
    staleTime: 10 * 60 * 1000, // POIs don't churn — cache for 10 min
    retry: 1,
  });
}
