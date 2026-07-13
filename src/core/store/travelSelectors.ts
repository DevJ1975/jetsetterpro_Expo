import type { ItineraryItem, Trip } from '@/src/types/models';

// Pure trip selectors, deliberately kept free of store/Firebase/AsyncStorage
// imports so they can be reused (Home, IRIS context/triggers, tools) and unit
// tested without booting the persisted Zustand store or the Firebase SDK.

/** The active trip (today within its range) or the next upcoming one. */
export function activeOrNextTrip(trips: Trip[], now: Date = new Date()): Trip | undefined {
  const today = now.toISOString().slice(0, 10);
  const active = trips.find((t) => t.startDate <= today && t.endDate >= today);
  if (active) return active;
  return [...trips]
    .filter((t) => t.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
}

/** The next upcoming flight across all trips. */
export function nextUpcomingFlight(
  trips: Trip[],
  now: Date = new Date(),
): { trip: Trip; item: ItineraryItem } | undefined {
  const iso = now.toISOString();
  const candidates = trips
    .flatMap((trip) => trip.items.map((item) => ({ trip, item })))
    .filter(({ item }) => item.type === 'flight' && item.startDate > iso)
    .sort((a, b) => a.item.startDate.localeCompare(b.item.startDate));
  return candidates[0];
}
