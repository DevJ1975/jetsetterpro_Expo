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
  // ── Additive richness (check-in minted passes / itinerary-derived docs) ────
  /** ISO end instant for ranged documents (hotel stays) — keeps them Active. */
  endDate?: string;
  /** Flight ident for boarding passes, e.g. 'AA169'. */
  ident?: string;
  /** Origin IATA (boarding passes). */
  origin?: string;
  /** Destination IATA (boarding passes). */
  destination?: string;
  /** Confirmed seat (boarding passes minted by check-in). */
  seat?: string;
  /** Airline display name, when known. */
  airline?: string;
}

export const WALLET_KINDS: WalletKind[] = ['boardingPass', 'hotel', 'car', 'ticket', 'other'];
export const WALLET_META: Record<WalletKind, { icon: string; label: string }> = {
  boardingPass: { icon: 'airplane', label: 'Boarding Pass' },
  hotel: { icon: 'bed', label: 'Hotel' },
  car: { icon: 'car-sport', label: 'Rental Car' },
  ticket: { icon: 'ticket', label: 'Ticket' },
  other: { icon: 'wallet', label: 'Other' },
};

// ── Status classification (port of iOS WalletItem.status) ───────────────────

export type WalletStatus = 'active' | 'upcoming' | 'past';

/** Grace window a single-instant document stays "active" past its start time
 *  (iOS `timeOfUseGrace`): boarding passes cover a typical flight, car/ticket
 *  a shorter window; ranged docs (hotels) supply an explicit endDate. */
const GRACE_MS: Record<WalletKind, number> = {
  boardingPass: 6 * 3_600_000,
  car: 4 * 3_600_000,
  ticket: 4 * 3_600_000,
  hotel: 0,
  other: 2 * 3_600_000,
};

function parseInstant(iso: string): number {
  // Date-only strings parse as UTC midnight; pin them to local midnight so the
  // document stays on its intended calendar day.
  return Date.parse(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/** ACTIVE NOW / UPCOMING / PAST for a wallet item at `nowMs`. */
export function walletStatus(item: WalletItem, nowMs: number): WalletStatus {
  if (!item.date) return 'upcoming';
  const start = parseInstant(item.date);
  if (!Number.isFinite(start)) return 'upcoming';
  const explicitEnd = item.endDate ? parseInstant(item.endDate) : NaN;
  const end = Number.isFinite(explicitEnd)
    ? explicitEnd
    : // Date-only documents (no time component) stay active for the whole day.
      start + (item.date.length === 10 ? 24 * 3_600_000 : GRACE_MS[item.kind]);
  if (end < nowMs) return 'past';
  if (start <= nowMs) return 'active';
  return 'upcoming';
}

// ── Store ────────────────────────────────────────────────────────────────────

/** Transient banner message for the wallet screen. Never persisted. */
export interface WalletNotice {
  text: string;
  error?: boolean;
}

interface WalletState {
  items: WalletItem[];
  notice: WalletNotice | null;
  add: (i: WalletItem) => void;
  remove: (id: string) => void;
  /** Additive: replace-by-id or insert (used by the check-in flow to mint /
   *  refresh a boarding pass without duplicating it). */
  upsert: (i: WalletItem) => void;
  setNotice: (text: string | null, error?: boolean) => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      items: [],
      notice: null,
      add: (i) =>
        set({
          items: [...get().items, i],
          notice: { text: `"${i.title}" added to wallet.` },
        }),
      remove: (id) => {
        const removed = get().items.find((x) => x.id === id);
        set({
          items: get().items.filter((x) => x.id !== id),
          notice: removed ? { text: `"${removed.title}" removed from wallet.` } : get().notice,
        });
      },
      upsert: (i) => {
        const exists = get().items.some((x) => x.id === i.id);
        set({
          items: exists ? get().items.map((x) => (x.id === i.id ? i : x)) : [...get().items, i],
          notice: { text: exists ? `"${i.title}" updated.` : `"${i.title}" added to wallet.` },
        });
      },
      setNotice: (text, error) => set({ notice: text ? { text, error } : null }),
    }),
    {
      name: 'jetsetter_wallet_items',
      storage: zustandStorage,
      // The banner is view state — only documents persist.
      partialize: (s) => ({ items: s.items }),
    },
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
        endDate: item.endDate,
      });
    }
  }
  return out;
}
