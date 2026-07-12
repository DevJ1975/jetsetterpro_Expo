import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Photo scrapbook per trip (the RN port of Trip Journal). Stores image URIs from
// the picker; a permanent copy into the app document dir is a later hardening.

interface JournalState {
  photos: Record<string, string[]>; // tripId → uris
  addPhotos: (tripId: string, uris: string[]) => void;
  removePhoto: (tripId: string, uri: string) => void;
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      photos: {},
      addPhotos: (tripId, uris) => {
        const existing = get().photos[tripId] ?? [];
        const merged = [...existing, ...uris.filter((u) => !existing.includes(u))];
        set({ photos: { ...get().photos, [tripId]: merged } });
      },
      removePhoto: (tripId, uri) =>
        set({
          photos: { ...get().photos, [tripId]: (get().photos[tripId] ?? []).filter((u) => u !== uri) },
        }),
    }),
    { name: 'jetsetter_trip_journal', storage: zustandStorage },
  ),
);
