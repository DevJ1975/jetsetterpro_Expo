import type { Expense, Trip } from '@/src/types/models';
import { isSupabaseConfigured, supabase } from './client';
import {
  ExpenseRow,
  TripRow,
  expenseToRow,
  rowToExpense,
  rowToTrip,
  tripToRow,
} from './mappers';

// Improves on the iOS app's manual "Back up" tap: we push on every mutation and
// pull+merge on launch. Merge policy is last-writer-by-existence (remote wins for
// shared ids, local-only rows get pushed up). A proper `updated_at` CRDT-style
// merge / Realtime subscription is a later enhancement — this keeps trips and
// expenses eventually consistent across devices today.

const ready = () => isSupabaseConfigured();

export async function pushTrip(trip: Trip): Promise<void> {
  if (!ready()) return;
  const { error } = await supabase.from('trips').upsert(tripToRow(trip));
  if (error) console.warn('[sync] pushTrip:', error.message);
}

export async function deleteTripRemote(id: string): Promise<void> {
  if (!ready()) return;
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) console.warn('[sync] deleteTrip:', error.message);
}

export async function pushExpense(expense: Expense): Promise<void> {
  if (!ready()) return;
  const { error } = await supabase.from('expenses').upsert(expenseToRow(expense));
  if (error) console.warn('[sync] pushExpense:', error.message);
}

export async function deleteExpenseRemote(id: string): Promise<void> {
  if (!ready()) return;
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) console.warn('[sync] deleteExpense:', error.message);
}

async function pullTrips(): Promise<Trip[]> {
  const { data, error } = await supabase.from('trips').select('*');
  if (error) {
    console.warn('[sync] pullTrips:', error.message);
    return [];
  }
  return (data as TripRow[]).map(rowToTrip);
}

async function pullExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*');
  if (error) {
    console.warn('[sync] pullExpenses:', error.message);
    return [];
  }
  return (data as ExpenseRow[]).map(rowToExpense);
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

export interface ReconcileResult {
  trips: Trip[];
  expenses: Expense[];
}

/** Pull remote, merge with local, and push any local-only rows up. Returns the
 *  merged collections for the store to adopt. No-op (returns local) when unconfigured. */
export async function reconcile(localTrips: Trip[], localExpenses: Expense[]): Promise<ReconcileResult> {
  if (!ready()) return { trips: localTrips, expenses: localExpenses };

  const [remoteTrips, remoteExpenses] = await Promise.all([pullTrips(), pullExpenses()]);

  const t = mergeById(remoteTrips, localTrips);
  const e = mergeById(remoteExpenses, localExpenses);

  // Push local-only rows so other devices see them (best-effort, parallel).
  await Promise.all([
    ...t.localOnly.map(pushTrip),
    ...e.localOnly.map(pushExpense),
  ]);

  return { trips: t.merged, expenses: e.merged };
}
