import { collection, limit as fbLimit, onSnapshot, orderBy, query, setDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';
import { db } from '@/src/core/firebase/firestore';
import { useSession } from '@/src/core/store/session';

// Disruption events written by the scheduled `disruptionWatch` function into
// users/{uid}/disruptions — consumed live by the dashboard + home banner.

export type DisruptionKind = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED' | 'DIVERTED';

const KNOWN_KINDS: readonly DisruptionKind[] = ['DELAY', 'GATE_CHANGE', 'CANCELLED', 'DIVERTED'];

/** A feed doc is usable only if it has an id and a known kind — guards the
 *  banner/ticker/mark-read against a malformed or future-kind document. */
function isValidEvent(e: Partial<DisruptionEvent> | undefined): e is DisruptionEvent {
  return (
    !!e &&
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    KNOWN_KINDS.includes(e.kind as DisruptionKind)
  );
}

export interface DisruptionEvent {
  id: string;
  kind: DisruptionKind;
  ident: string;
  date: string;
  title: string;
  message: string;
  delta?: { gate?: [string, string]; delayMin?: number } | null;
  createdAt: string;
  readAt?: string | null;
}

/** Live feed of the user's disruption events, newest first. */
export function useDisruptions(max = 20): DisruptionEvent[] {
  const [events, setEvents] = useState<DisruptionEvent[]>([]);
  // Depend on the session uid so the listener (re)attaches once anonymous
  // sign-in resolves — on cold start the home banner mounts before auth is
  // ready, and auth.currentUser alone would never re-trigger this effect.
  const uid = useSession((s) => s.userId);
  useEffect(() => {
    const activeUid = uid ?? auth.currentUser?.uid;
    if (!isFirebaseConfigured() || !activeUid) return;
    const q = query(
      collection(db, 'users', activeUid, 'disruptions'),
      orderBy('createdAt', 'desc'),
      fbLimit(max),
    );
    return onSnapshot(
      q,
      (snap) => setEvents(snap.docs.map((d) => d.data() as Partial<DisruptionEvent>).filter(isValidEvent)),
      () => setEvents([]),
    );
  }, [max, uid]);
  return events;
}

export async function markDisruptionRead(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!isFirebaseConfigured() || !uid) return;
  try {
    await setDoc(
      doc(db, 'users', uid, 'disruptions', id),
      { readAt: new Date().toISOString() },
      { merge: true },
    );
  } catch (e) {
    console.warn('[disruptions] markRead:', e);
  }
}
