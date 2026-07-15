import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

export interface OfflineFxRow {
  code: string;
  rate: number;
}

/** Perishable data captured at prepare time so the Offline Kit screen can
 *  preview it without connectivity (additive — older persisted state without
 *  `snapshots` rehydrates against the default below). */
export interface OfflineSnapshot {
  at: string; // ISO timestamp of the cache run
  weather?: string; // e.g. "18° · Partly cloudy"
  fxBase?: string; // home currency the rows are quoted from
  fx?: OfflineFxRow[];
}

interface OfflineState {
  prepared: Record<string, string>; // tripId → ISO timestamp
  snapshots: Record<string, OfflineSnapshot>; // tripId → cached preview data
  markPrepared: (tripId: string) => void;
  setSnapshot: (tripId: string, snapshot: OfflineSnapshot) => void;
}

export const useOffline = create<OfflineState>()(
  persist(
    (set, get) => ({
      prepared: {},
      snapshots: {},
      markPrepared: (tripId) => set({ prepared: { ...get().prepared, [tripId]: new Date().toISOString() } }),
      setSnapshot: (tripId, snapshot) =>
        set({ snapshots: { ...get().snapshots, [tripId]: snapshot } }),
    }),
    { name: 'jetsetter_offline_kit', storage: zustandStorage },
  ),
);
