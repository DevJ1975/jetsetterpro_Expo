import type { Expense, ItineraryItem, PackingItem, Trip } from '@/src/types/models';

// PostgREST row shapes for schema-v1 (snake_case dates; user_id is DB-defaulted
// and never sent by the client).

export interface TripRow {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  items: ItineraryItem[] | null;
  packing_list: PackingItem[] | null;
}

export interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  date: string;
  notes: string | null;
}

export function tripToRow(t: Trip): TripRow {
  return {
    id: t.id,
    name: t.name,
    destination: t.destination,
    start_date: t.startDate,
    end_date: t.endDate,
    items: t.items ?? [],
    packing_list: t.packingList ?? [],
  };
}

export function rowToTrip(r: TripRow): Trip {
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    startDate: r.start_date,
    endDate: r.end_date,
    items: r.items ?? [],
    packingList: r.packing_list ?? [],
  };
}

export function expenseToRow(e: Expense): ExpenseRow {
  return {
    id: e.id,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    merchant: e.merchant,
    date: e.date,
    notes: e.notes ?? null,
  };
}

export function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    category: (r.category as Expense['category']) ?? 'OTHER',
    merchant: r.merchant,
    date: r.date,
    notes: r.notes ?? undefined,
  };
}
