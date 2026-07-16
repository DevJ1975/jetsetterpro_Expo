import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

export type BagStatus =
  | 'checked'
  | 'inTransit'
  | 'loaded'
  | 'arrived'
  | 'delivered'
  | 'missing'
  | 'delayed'
  | 'lost';

export interface Bag {
  id: string;
  label: string;
  tagNumber?: string;
  airline?: string;
  status: BagStatus;
  updatedAt: string; // ISO
  /** e.g. "UA837" — shown next to the airline on rows + detail. */
  flightNumber?: string;
  /** AirTag attached → "Find My" hand-off (iOS only). */
  hasAirTag?: boolean;
  /** Last reported scan location, e.g. "Chicago O'Hare (ORD)". */
  lastLocation?: string;
}

export const BAG_STATUSES: BagStatus[] = [
  'checked',
  'inTransit',
  'loaded',
  'arrived',
  'delivered',
  'missing',
  'delayed',
  'lost',
];
// `color` mirrors the iOS BagStatus.colorHex family (LuggageModel.swift) and
// drives status tiles / the detail header; `tone` keeps the design-kit Badge.
export const BAG_STATUS_META: Record<
  BagStatus,
  { label: string; tone: 'accent' | 'good' | 'warn' | 'bad'; icon: string; color: string }
> = {
  checked: { label: 'Checked in', tone: 'accent', icon: 'checkmark-circle', color: '#0066CC' },
  inTransit: { label: 'In transit', tone: 'accent', icon: 'airplane', color: '#3B9EF0' },
  loaded: { label: 'Loaded', tone: 'accent', icon: 'arrow-up-circle', color: '#7B3FBF' },
  arrived: { label: 'Arrived', tone: 'good', icon: 'checkmark-done-circle', color: '#0A7A5E' },
  delivered: { label: 'Delivered', tone: 'good', icon: 'ribbon', color: '#1DB97D' },
  missing: { label: 'Missing', tone: 'bad', icon: 'alert-circle', color: '#FF5C5C' },
  delayed: { label: 'Delayed', tone: 'warn', icon: 'time', color: '#E8A020' },
  lost: { label: 'Lost', tone: 'bad', icon: 'alert-circle', color: '#FF5C5C' },
};

interface LuggageState {
  bags: Bag[];
  add: (b: Bag) => void;
  setStatus: (id: string, status: BagStatus) => void;
  /** Replace a bag wholesale (refresh re-derive, edits). Stamps updatedAt. */
  update: (b: Bag) => void;
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
      update: (b) =>
        set({
          bags: get().bags.map((x) => (x.id === b.id ? { ...b, updatedAt: new Date().toISOString() } : x)),
        }),
      remove: (id) => set({ bags: get().bags.filter((x) => x.id !== id) }),
    }),
    { name: 'jetsetter_bags', storage: zustandStorage },
  ),
);
