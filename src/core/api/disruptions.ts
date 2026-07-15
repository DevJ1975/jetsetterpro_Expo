import { collection, limit as fbLimit, onSnapshot, orderBy, query, setDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';
import { db } from '@/src/core/firebase/firestore';

// Disruption events written by the scheduled `disruptionWatch` function into
// users/{uid}/disruptions — consumed live by the dashboard + home banner.

export type DisruptionKind = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED' | 'DIVERTED';

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
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!isFirebaseConfigured() || !uid) return;
    const q = query(
      collection(db, 'users', uid, 'disruptions'),
      orderBy('createdAt', 'desc'),
      fbLimit(max),
    );
    return onSnapshot(
      q,
      (snap) => setEvents(snap.docs.map((d) => d.data() as DisruptionEvent)),
      () => setEvents([]),
    );
  }, [max]);
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
