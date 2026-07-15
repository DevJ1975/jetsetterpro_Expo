import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  initializeFirestore,
  setDoc,
} from 'firebase/firestore';
import type { Expense, Trip } from '@/src/types/models';
import { auth } from './auth';
import { firebaseApp, isFirebaseConfigured } from './config';

// Per-user Firestore: users/{uid}/trips/{id} and users/{uid}/expenses/{id}
// (mirrors the iOS Firebase collection layout). `ignoreUndefinedProperties`
// lets optional model fields (notes, endDate, …) round-trip cleanly.
let db: Firestore;
try {
  db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
} catch {
  db = getFirestore(firebaseApp);
}
export { db };

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}
const ready = () => isFirebaseConfigured() && !!uid();

export async function pushTrip(trip: Trip): Promise<void> {
  if (!ready()) return;
  try {
    await setDoc(doc(db, 'users', uid()!, 'trips', trip.id), trip);
  } catch (e) {
    console.warn('[firestore] pushTrip:', e);
  }
}

export async function deleteTripRemote(id: string): Promise<void> {
  if (!ready()) return;
  try {
    await deleteDoc(doc(db, 'users', uid()!, 'trips', id));
  } catch (e) {
    console.warn('[firestore] deleteTrip:', e);
  }
}

export async function pushExpense(expense: Expense): Promise<void> {
  if (!ready()) return;
  try {
    await setDoc(doc(db, 'users', uid()!, 'expenses', expense.id), expense);
  } catch (e) {
    console.warn('[firestore] pushExpense:', e);
  }
}

export async function deleteExpenseRemote(id: string): Promise<void> {
  if (!ready()) return;
  try {
    await deleteDoc(doc(db, 'users', uid()!, 'expenses', id));
  } catch (e) {
    console.warn('[firestore] deleteExpense:', e);
  }
}

async function pullTrips(): Promise<Trip[]> {
  const snap = await getDocs(collection(db, 'users', uid()!, 'trips'));
  return snap.docs.map((d) => d.data() as Trip);
}

async function pullExpenses(): Promise<Expense[]> {
  const snap = await getDocs(collection(db, 'users', uid()!, 'expenses'));
  return snap.docs.map((d) => d.data() as Expense);
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

/** Pull remote, merge with local (remote wins for shared ids), push local-only up.
 *  No-op (returns local) when unconfigured / signed out. */
export async function reconcile(localTrips: Trip[], localExpenses: Expense[]): Promise<ReconcileResult> {
  if (!ready()) return { trips: localTrips, expenses: localExpenses };
  try {
    const [remoteTrips, remoteExpenses] = await Promise.all([pullTrips(), pullExpenses()]);
    const t = mergeById(remoteTrips, localTrips);
    const e = mergeById(remoteExpenses, localExpenses);
    await Promise.all([...t.localOnly.map(pushTrip), ...e.localOnly.map(pushExpense)]);
    return { trips: t.merged, expenses: e.merged };
  } catch (err) {
    console.warn('[firestore] reconcile:', err);
    return { trips: localTrips, expenses: localExpenses };
  }
}

/** Wipe the signed-in user's Firestore subtree (used by account deletion). */
export async function wipeAllRemote(): Promise<void> {
  if (!ready()) return;
  const subcollections = ['trips', 'expenses', 'pushTokens', 'disruptions', 'duffelOrders'];
  const snaps = await Promise.all(
    subcollections.map((c) => getDocs(collection(db, 'users', uid()!, c))),
  );
  await Promise.all(snaps.flatMap((snap) => snap.docs.map((d) => deleteDoc(d.ref))));
  // Root-collection watch docs are keyed by uid field, not the subtree.
  const { wipeFlightWatches } = await import('./flightWatches');
  await wipeFlightWatches();
}
