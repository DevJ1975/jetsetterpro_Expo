import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

export type LoyaltyKind = 'airline' | 'hotel' | 'car' | 'other';

export interface LoyaltyAccount {
  id: string;
  program: string;
  kind: LoyaltyKind;
  memberNumber: string;
  tier?: string;
  points?: number;
  tierExpiration?: string; // ISO date
  /** Catalog id (src/features/vaults/loyaltyPrograms.ts) for brand tile/color. */
  programId?: string;
}

export const LOYALTY_KINDS: LoyaltyKind[] = ['airline', 'hotel', 'car', 'other'];
export const LOYALTY_META: Record<LoyaltyKind, { icon: string; label: string }> = {
  airline: { icon: 'airplane', label: 'Airlines' },
  hotel: { icon: 'bed', label: 'Hotels' },
  car: { icon: 'car-sport', label: 'Car Rental' },
  other: { icon: 'ribbon', label: 'Other' },
};

interface LoyaltyState {
  accounts: LoyaltyAccount[];
  add: (a: LoyaltyAccount) => void;
  update: (a: LoyaltyAccount) => void;
  remove: (id: string) => void;
}

export const useLoyalty = create<LoyaltyState>()(
  persist(
    (set, get) => ({
      accounts: [],
      add: (a) => set({ accounts: [...get().accounts, a] }),
      update: (a) => set({ accounts: get().accounts.map((x) => (x.id === a.id ? a : x)) }),
      remove: (id) => set({ accounts: get().accounts.filter((x) => x.id !== id) }),
    }),
    { name: 'jetsetter_loyalty_accounts', storage: zustandStorage },
  ),
);
