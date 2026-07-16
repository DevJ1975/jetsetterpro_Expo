import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { makeId } from '@/src/core/format';

// Port of iOS Core/Services/LovedOnesStore.swift: the people IRIS offers to
// text on takeoff and landing. Persisted locally; numbers never leave the
// device except when the user sends the pre-filled message themselves.

export const RELATIONSHIPS = ['Partner', 'Family', 'Friend', 'Colleague', 'Other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface LovedOne {
  id: string;
  name: string;
  phone: string;
  relationship: Relationship;
  /** Text this person when the flight takes off. */
  notifyOnTakeoff: boolean;
  /** Text this person when the flight lands. */
  notifyOnLanding: boolean;
}

/** Dialable digits (keeping one leading "+") so two spellings compare equal. */
export function dialDigits(raw: string): string {
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

interface LovedOnesState {
  contacts: LovedOne[];
  _hasHydrated: boolean;
  add: (contact: Omit<LovedOne, 'id'>) => void;
  update: (contact: LovedOne) => void;
  remove: (id: string) => void;
  /** Wipe all stored contacts (the "Clear Local Data" privacy flow). */
  removeAll: () => void;
}

export const useLovedOnes = create<LovedOnesState>()(
  persist(
    (set, get) => ({
      contacts: [],
      _hasHydrated: false,
      add: (contact) => {
        const name = contact.name.trim();
        const phone = contact.phone.trim();
        if (!name || !phone) return;
        // Skip duplicates of the same normalized number so nobody gets texted twice.
        const normalized = dialDigits(phone);
        if (get().contacts.some((c) => dialDigits(c.phone) === normalized)) return;
        set({ contacts: [...get().contacts, { ...contact, name, phone, id: makeId() }] });
      },
      update: (contact) =>
        set({ contacts: get().contacts.map((c) => (c.id === contact.id ? contact : c)) }),
      remove: (id) => set({ contacts: get().contacts.filter((c) => c.id !== id) }),
      removeAll: () => set({ contacts: [] }),
    }),
    {
      name: 'jetsetter_loved_ones',
      storage: zustandStorage,
      partialize: (s) => ({ contacts: s.contacts }),
      onRehydrateStorage: () => () => {
        useLovedOnes.setState({ _hasHydrated: true });
      },
    },
  ),
);
