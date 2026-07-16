import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { parseRoute } from '@/src/core/flightPhase';
import type { Trip } from '@/src/types/models';
import { auth } from './auth';
import { isFirebaseConfigured } from './config';
import { db } from './firestore';

// Trips store flights inside an `items` array, which the scheduled
// disruptionWatch function can't query. This mirrors upcoming flights
// (≤72h out) into a flat root collection it can:
//
//   flightWatches/{uid}_{IDENT}_{YYYY-MM-DD}
//     { uid, ident, date, depUtc, origin, dest, title, notify, lastSnapshot? }
//
// Synced after reconcile and best-effort after trip mutations. Rules restrict
// each doc to its own uid.

const HORIZON_MS = 72 * 3600_000;

interface WatchDoc {
  uid: string;
  ident: string;
  date: string;
  depUtc: string;
  origin: string;
  dest: string;
  title: string;
  notify: boolean;
  createdAt: string;
}

/** Pure: derive the watch set for the next 72h from the user's trips. */
export function deriveWatches(uid: string, trips: Trip[], now = Date.now()): WatchDoc[] {
  const out: WatchDoc[] = [];
  for (const trip of trips) {
    for (const item of trip.items) {
      if (item.type !== 'flight') continue;
      const ident = extractFlightNumber(item.title);
      if (!ident) continue;
      const dep = Date.parse(item.startDate);
      if (!Number.isFinite(dep) || dep < now - 3600_000 || dep > now + HORIZON_MS) continue;
      const { origin, dest } = parseRoute(item.title);
      const date = item.startDate.slice(0, 10);
      out.push({
        uid,
        ident,
        date,
        depUtc: new Date(dep).toISOString(),
        origin,
        dest,
        title: item.title,
        notify: true,
        createdAt: new Date(now).toISOString(),
      });
    }
  }
  return out;
}

export function watchId(w: Pick<WatchDoc, 'uid' | 'ident' | 'date'>): string {
  return `${w.uid}_${w.ident}_${w.date}`;
}

/** Upsert current watches; delete owned docs no longer derivable. */
export async function syncFlightWatches(trips: Trip[]): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!isFirebaseConfigured() || !uid) return;
  try {
    const wanted = deriveWatches(uid, trips);
    const wantedIds = new Set(wanted.map(watchId));

    const existing = await getDocs(query(collection(db, 'flightWatches'), where('uid', '==', uid)));
    await Promise.all([
      // merge:true preserves lastSnapshot/lastCheckedAt written by the watcher
      ...wanted.map((w) => setDoc(doc(db, 'flightWatches', watchId(w)), w, { merge: true })),
      ...existing.docs.filter((d) => !wantedIds.has(d.id)).map((d) => deleteDoc(d.ref)),
    ]);
  } catch (e) {
    console.warn('[flightWatches] sync:', e);
  }
}

/** Remove all of this user's watch docs (account deletion). */
export async function wipeFlightWatches(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!isFirebaseConfigured() || !uid) return;
  try {
    const existing = await getDocs(query(collection(db, 'flightWatches'), where('uid', '==', uid)));
    await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  } catch (e) {
    console.warn('[flightWatches] wipe:', e);
  }
}
