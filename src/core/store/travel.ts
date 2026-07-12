import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StorageKeys, zustandStorage } from '@/src/core/persistence/kv';
import {
  deleteExpenseRemote,
  deleteTripRemote,
  pushExpense,
  pushTrip,
} from '@/src/core/firebase/firestore';
import type { Expense, ItineraryItem, PackingItem, Trip } from '@/src/types/models';

// Local-first source of truth for trips + expenses (the RN analog of the iOS
// TravelStore). Every mutation updates local state immediately and fires a
// best-effort push to Firestore; no-op when the backend is unconfigured.

interface TravelState {
  trips: Trip[];
  expenses: Expense[];
  _hasHydrated: boolean;
  addTrip: (t: Trip) => void;
  updateTrip: (t: Trip) => void;
  removeTrip: (id: string) => void;
  addItineraryItem: (tripId: string, item: ItineraryItem) => void;
  removeItineraryItem: (tripId: string, itemId: string) => void;
  setPackingList: (tripId: string, items: PackingItem[]) => void;
  togglePackingItem: (tripId: string, itemId: string) => void;
  addExpense: (e: Expense) => void;
  updateExpense: (e: Expense) => void;
  removeExpense: (id: string) => void;
  /** Replace both collections (used by demo seeding + sync reconcile). */
  setAll: (trips: Trip[], expenses: Expense[]) => void;
}

const sortTripItems = (t: Trip): Trip => ({
  ...t,
  items: [...t.items].sort((a, b) => a.startDate.localeCompare(b.startDate)),
});

export const useTravel = create<TravelState>()(
  persist(
    (set, get) => ({
      trips: [],
      expenses: [],
      _hasHydrated: false,

      addTrip: (t) => {
        const trip = sortTripItems(t);
        set({ trips: [...get().trips, trip] });
        void pushTrip(trip);
      },
      updateTrip: (t) => {
        const trip = sortTripItems(t);
        set({ trips: get().trips.map((x) => (x.id === trip.id ? trip : x)) });
        void pushTrip(trip);
      },
      removeTrip: (id) => {
        set({ trips: get().trips.filter((x) => x.id !== id) });
        void deleteTripRemote(id);
      },
      addItineraryItem: (tripId, item) => {
        const trip = get().trips.find((x) => x.id === tripId);
        if (!trip) return;
        get().updateTrip({ ...trip, items: [...trip.items, item] });
      },
      removeItineraryItem: (tripId, itemId) => {
        const trip = get().trips.find((x) => x.id === tripId);
        if (!trip) return;
        get().updateTrip({ ...trip, items: trip.items.filter((i) => i.id !== itemId) });
      },

      setPackingList: (tripId, items) => {
        const trip = get().trips.find((x) => x.id === tripId);
        if (!trip) return;
        get().updateTrip({ ...trip, packingList: items });
      },
      togglePackingItem: (tripId, itemId) => {
        const trip = get().trips.find((x) => x.id === tripId);
        if (!trip?.packingList) return;
        get().updateTrip({
          ...trip,
          packingList: trip.packingList.map((p) =>
            p.id === itemId ? { ...p, packed: !p.packed } : p,
          ),
        });
      },

      addExpense: (e) => {
        set({ expenses: [e, ...get().expenses] });
        void pushExpense(e);
      },
      updateExpense: (e) => {
        set({ expenses: get().expenses.map((x) => (x.id === e.id ? e : x)) });
        void pushExpense(e);
      },
      removeExpense: (id) => {
        set({ expenses: get().expenses.filter((x) => x.id !== id) });
        void deleteExpenseRemote(id);
      },

      setAll: (trips, expenses) => set({ trips: trips.map(sortTripItems), expenses }),
    }),
    {
      name: StorageKeys.travel,
      storage: zustandStorage,
      partialize: (s) => ({ trips: s.trips, expenses: s.expenses }),
      onRehydrateStorage: () => () => {
        useTravel.setState({ _hasHydrated: true });
      },
    },
  ),
);

// ── Selectors (pure) ─────────────────────────────────────────────────────────

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

/**
 * The flight to show a tracker for: the one currently airborne (departed but not
 * yet arrived) if any, otherwise the next upcoming one. Unlike
 * `nextUpcomingFlight` (future-only), this surfaces in-progress flights.
 */
export function currentOrNextFlight(
  trips: Trip[],
  now: Date = new Date(),
): { trip: Trip; item: ItineraryItem } | undefined {
  const iso = now.toISOString();
  const inAir = trips
    .flatMap((trip) => trip.items.map((item) => ({ trip, item })))
    .filter(({ item }) => item.type === 'flight' && item.startDate <= iso && (item.endDate ?? '') >= iso)
    .sort((a, b) => a.item.startDate.localeCompare(b.item.startDate));
  return inAir[0] ?? nextUpcomingFlight(trips, now);
}
