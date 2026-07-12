import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import type { Trip } from '@/src/types/models';

export type WalletKind = 'boardingPass' | 'hotel' | 'car' | 'ticket' | 'other';

export interface WalletItem {
  id: string;
  kind: WalletKind;
  title: string;
  subtitle?: string;
  code?: string;
  date?: string; // ISO
  location?: string;
}

export const WALLET_KINDS: WalletKind[] = ['boardingPass', 'hotel', 'car', 'ticket', 'other'];
export const WALLET_META: Record<WalletKind, { icon: string; label: string }> = {
  boardingPass: { icon: 'airplane', label: 'Boarding Pass' },
  hotel: { icon: 'bed', label: 'Hotel' },
  car: { icon: 'car-sport', label: 'Rental Car' },
  ticket: { icon: 'ticket', label: 'Ticket' },
  other: { icon: 'wallet', label: 'Other' },
};

interface WalletState {
  items: WalletItem[];
  add: (i: WalletItem) => void;
  remove: (id: string) => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (i) => set({ items: [...get().items, i] }),
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
    }),
    { name: 'jetsetter_wallet_items', storage: zustandStorage },
  ),
);

const KIND_FROM_ITEM: Partial<Record<string, WalletKind>> = {
  flight: 'boardingPass',
  hotel: 'hotel',
  car: 'car',
  boardingPass: 'boardingPass',
};

/** Passes derived from itinerary items (flights, hotels, cars). */
export function passesFromTrips(trips: Trip[]): WalletItem[] {
  const out: WalletItem[] = [];
  for (const trip of trips) {
    for (const item of trip.items) {
      const kind = KIND_FROM_ITEM[item.type];
      if (!kind) continue;
      out.push({
        id: `derived-${item.id}`,
        kind,
        title: item.title,
        subtitle: trip.name,
        code: item.confirmation,
        date: item.startDate,
        location: item.location,
      });
    }
  }
  return out;
}
