import { useQuery } from '@tanstack/react-query';
import { geocodeCity } from './weather';

// Nearby places from OpenStreetMap via the Overpass API — no API key required
// (kept a direct client call, matching the app's keyless-public-API posture).
// Geocoding reuses Open-Meteo (see weather.ts); Overpass returns POIs tagged in
// OSM around that point.

export type PlaceCategory =
  | 'restaurants'
  | 'attractions'
  | 'cafes'
  | 'nightlife'
  | 'shopping';

export interface Place {
  id: string;
  name: string;
  kind: string; // short human label, e.g. "Restaurant · Sushi"
  lat: number;
  lon: number;
  distanceM: number;
}

// Category → OSM tag filters (each becomes one `node[...]` clause in the union).
const CATEGORY_TAGS: Record<PlaceCategory, string[]> = {
  restaurants: ['amenity=restaurant'],
  cafes: ['amenity=cafe'],
  attractions: ['tourism=attraction', 'tourism=museum', 'tourism=artwork', 'historic=monument'],
  nightlife: ['amenity=bar', 'amenity=pub', 'amenity=nightclub'],
  shopping: ['shop=mall', 'shop=department_store', 'shop=gift', 'shop=clothes'],
};

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 2500;
const MAX_RESULTS = 25;

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

/** Human-friendly label from OSM tags, e.g. "Restaurant · Sushi". */
function labelFor(tags: Record<string, string>): string {
  const primary =
    tags.amenity ?? tags.tourism ?? tags.shop ?? tags.historic ?? 'Place';
  const nice = primary.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const detail = tags.cuisine?.split(';')[0]?.replace(/_/g, ' ');
  return detail ? `${nice} · ${detail.replace(/\b\w/g, (c) => c.toUpperCase())}` : nice;
}

function buildQuery(lat: number, lon: number, tags: string[]): string {
  const clauses = tags
    .map((t) => {
      const [k, v] = t.split('=');
      return `node(around:${RADIUS_M},${lat},${lon})["${k}"="${v}"]["name"];`;
    })
    .join('');
  return `[out:json][timeout:20];(${clauses});out body ${MAX_RESULTS * 2};`;
}

export async function fetchPlaces(city: string, category: PlaceCategory): Promise<Place[]> {
  const g = await geocodeCity(city);
  if (!g) return [];
  const body = buildQuery(g.lat, g.lon, CATEGORY_TAGS[category]);
  const r = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(body)}`,
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = (await r.json()) as { elements?: OverpassElement[] };
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const el of j.elements ?? []) {
    const name = el.tags?.name;
    if (!name || el.lat == null || el.lon == null || seen.has(name)) continue;
    seen.add(name);
    places.push({
      id: String(el.id),
      name,
      kind: labelFor(el.tags ?? {}),
      lat: el.lat,
      lon: el.lon,
      distanceM: Math.round(haversineM(g.lat, g.lon, el.lat, el.lon)),
    });
  }
  return places.sort((a, b) => a.distanceM - b.distanceM).slice(0, MAX_RESULTS);
}

export function usePlaces(city: string | undefined, category: PlaceCategory | null) {
  return useQuery({
    queryKey: ['places', city, category],
    queryFn: () => fetchPlaces(city as string, category as PlaceCategory),
    enabled: !!city?.trim() && !!category,
    staleTime: 10 * 60 * 1000, // POIs don't churn — cache for 10 min
    retry: 1,
  });
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
