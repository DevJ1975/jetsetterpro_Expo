import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

export type BagStatus = 'checked' | 'inTransit' | 'arrived' | 'delayed' | 'lost';

export interface Bag {
  id: string;
  label: string;
  tagNumber?: string;
  airline?: string;
  status: BagStatus;
  updatedAt: string; // ISO
}

export const BAG_STATUSES: BagStatus[] = ['checked', 'inTransit', 'arrived', 'delayed', 'lost'];
export const BAG_STATUS_META: Record<BagStatus, { label: string; tone: 'accent' | 'good' | 'warn' | 'bad'; icon: string }> = {
  checked: { label: 'Checked in', tone: 'accent', icon: 'checkmark-circle' },
  inTransit: { label: 'In transit', tone: 'accent', icon: 'airplane' },
  arrived: { label: 'Arrived', tone: 'good', icon: 'checkmark-done-circle' },
  delayed: { label: 'Delayed', tone: 'warn', icon: 'time' },
  lost: { label: 'Lost', tone: 'bad', icon: 'alert-circle' },
};

interface LuggageState {
  bags: Bag[];
  add: (b: Bag) => void;
  setStatus: (id: string, status: BagStatus) => void;
  remove: (id: string) => void;
}

export const useLuggage = create<LuggageState>()(
  persist(
    (set, get) => ({
      bags: [],
      add: (b) => set({ bags: [...get().bags, b] }),
      setStatus: (id, status) =>
        set({
          bags: get().bags.map((x) => (x.id === id ? { ...x, status, updatedAt: new Date().toISOString() } : x)),
        }),
      remove: (id) => set({ bags: get().bags.filter((x) => x.id !== id) }),
    }),
    { name: 'jetsetter_bags', storage: zustandStorage },
  ),
);
