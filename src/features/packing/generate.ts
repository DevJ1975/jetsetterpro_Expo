import { makeId, parseDate } from '@/src/core/format';
import type { PackingItem, Trip } from '@/src/types/models';

// Deterministic packing list scaled by trip length, with an optional weather
// hint (destination forecast → rain gear / warm layers / sun protection). (The
// AI-generated version arrives when IRIS's packing tool is wired to a
// generation backend; this keeps the feature fully usable offline today.)

/** Optional destination-weather hint (from useWeather) to tailor the list. */
export interface WeatherHint {
  tempC?: number;
  /** e.g. 'Light rain', 'Overcast' — matched loosely for rain gear. */
  description?: string;
}

export function generatePackingList(
  trip: Trip,
  previous?: PackingItem[],
  weather?: WeatherHint,
): PackingItem[] {
  const start = parseDate(trip.startDate);
  const end = parseDate(trip.endDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

  // Preserve prior check-offs by label so "regenerate" doesn't lose progress.
  const packedByLabel = new Map((previous ?? []).map((p) => [p.label, p.packed] as const));
  const mk = (label: string, category: string): PackingItem => ({
    id: makeId(),
    label,
    category,
    packed: packedByLabel.get(label) ?? false,
  });

  const list: PackingItem[] = [];
  const push = (category: string, labels: string[]) => labels.forEach((l) => list.push(mk(l, category)));

  push('Documents', ['Passport / ID', 'Boarding passes', 'Wallet & cards', 'Travel insurance']);
  push('Essentials', ['Phone charger', 'Portable battery', 'Keys', 'Medications', 'Reusable water bottle']);
  push('Clothing', [
    `${nights + 1} × underwear`,
    `${nights + 1} × socks`,
    `${Math.max(2, Math.ceil(nights * 0.75))} × shirts`,
    `${Math.max(1, Math.ceil(nights / 3))} × pants`,
    'Sleepwear',
    'Light jacket',
    nights >= 4 ? 'Extra shoes' : 'Comfortable shoes',
  ]);
  push('Toiletries', ['Toothbrush & paste', 'Deodorant', 'Skincare', 'Razor', 'Sunscreen']);
  push('Electronics', ['Headphones', 'Laptop / tablet', 'Travel adapter', 'Cables']);

  // Weather-aware extras (additive — no hint, no change).
  const desc = weather?.description?.toLowerCase() ?? '';
  if (/rain|drizzle|shower|thunder/.test(desc)) {
    push('Clothing', ['Rain jacket', 'Compact umbrella']);
  }
  if (weather?.tempC != null && weather.tempC <= 8) {
    push('Clothing', ['Warm coat', 'Gloves & beanie']);
  }
  if (weather?.tempC != null && weather.tempC >= 28) {
    push('Essentials', ['Sunglasses', 'Hat / cap']);
  }

  return list;
}
