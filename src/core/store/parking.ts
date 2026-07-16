import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { deleteUserImage } from '@/src/core/firebase/storage';

// "Where did I park" — a single active parking spot (level/section/spot + an
// optional photo, GPS pin, and note), saved before heading to the flight and
// cleared on return. Mirrors the other local-first stores (luggage/loyalty):
// the screen builds a fully-formed spot (id + createdAt stamped in the save
// handler, never in render) and hands it to setSpot.

export interface ParkingSpot {
  id: string;
  /** Garage level / floor, e.g. "Level 3" or "P2". */
  level?: string;
  /** Section / zone / row, e.g. "Blue" or "Row H". */
  section?: string;
  /** Specific stall, e.g. "H-14". */
  spot?: string;
  /** Free-text reminder ("near the elevator", "by the blue pillar"). */
  note?: string;
  /** expo-image-picker asset uri (local fallback). */
  photoUri?: string;
  /** Cloud Storage download URL, once synced — survives reinstall/device change. */
  remoteUrl?: string;
  /** Cloud Storage object path, kept so the image can be deleted deterministically. */
  storagePath?: string;
  /** GPS pin captured at save time. */
  coords?: { latitude: number; longitude: number };
  /** Reverse-geocoded street address for the pin, if available. */
  address?: string;
  /** ISO timestamp the spot was saved. */
  createdAt: string;
}

interface ParkingState {
  spot?: ParkingSpot;
  setSpot: (spot: ParkingSpot) => void;
  clear: () => void;
}

export const useParking = create<ParkingState>()(
  persist(
    (set, get) => ({
      spot: undefined,
      setSpot: (spot) => set({ spot }),
      clear: () => {
        const prev = get().spot;
        if (prev?.storagePath) void deleteUserImage(prev.storagePath);
        set({ spot: undefined });
      },
    }),
    { name: 'jetsetter_parking', storage: zustandStorage },
  ),
);
