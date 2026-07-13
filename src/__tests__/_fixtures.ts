import type { Expense, ItineraryItem, Trip } from '@/src/types/models';

// Shared builders for trip/itinerary/expense fixtures. Not a test file (no
// `.test.ts` suffix) so Jest won't try to run it as a suite.

let seq = 0;
const nextId = () => `id-${++seq}`;

export function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: over.id ?? nextId(),
    name: over.name ?? 'Test Trip',
    destination: over.destination ?? 'Paris, France',
    startDate: over.startDate ?? '2026-08-01',
    endDate: over.endDate ?? '2026-08-05',
    items: over.items ?? [],
    packingList: over.packingList,
  };
}

export function makeFlight(over: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: over.id ?? nextId(),
    type: over.type ?? 'flight',
    title: over.title ?? 'AA100 to CDG',
    startDate: over.startDate ?? '2026-08-01T09:00:00.000Z',
    endDate: over.endDate,
    location: over.location,
    confirmation: over.confirmation,
    notes: over.notes,
  };
}

export function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: over.id ?? nextId(),
    amount: over.amount ?? 10,
    currency: over.currency ?? 'USD',
    category: over.category ?? 'FOOD',
    merchant: over.merchant ?? 'Cafe',
    date: over.date ?? '2026-08-02',
    notes: over.notes,
  };
}

/** A local-calendar ISO date `days` from `base` (DST-safe via the Date ctor). */
export function isoDaysFrom(days: number, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
