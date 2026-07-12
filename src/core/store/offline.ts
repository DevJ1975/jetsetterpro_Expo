import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

interface OfflineState {
  prepared: Record<string, string>; // tripId → ISO timestamp
  markPrepared: (tripId: string) => void;
}

export const useOffline = create<OfflineState>()(
  persist(
    (set, get) => ({
      prepared: {},
      markPrepared: (tripId) => set({ prepared: { ...get().prepared, [tripId]: new Date().toISOString() } }),
    }),
    { name: 'jetsetter_offline_kit', storage: zustandStorage },
  ),
);
