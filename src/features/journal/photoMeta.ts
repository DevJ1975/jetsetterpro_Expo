import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Per-photo capture dates for the Trip Journal. iOS reads PHAsset.creationDate
// straight from the photo library; the journal store (core) only keeps URIs,
// so this sidecar records a date per URI — EXIF capture date when the picker
// exposes it, else the day the photo was added — powering the "active days"
// stat and date-sorted grid.

interface PhotoMetaState {
  /** uri → 'YYYY-MM-DD' */
  dates: Record<string, string>;
  setDates: (entries: Record<string, string>) => void;
  removeUri: (uri: string) => void;
}

export const usePhotoMeta = create<PhotoMetaState>()(
  persist(
    (set, get) => ({
      dates: {},
      setDates: (entries) => set({ dates: { ...get().dates, ...entries } }),
      removeUri: (uri) => {
        const next = { ...get().dates };
        delete next[uri];
        set({ dates: next });
      },
    }),
    { name: 'jetsetter_journal_photo_meta', storage: zustandStorage },
  ),
);

/** EXIF 'YYYY:MM:DD HH:MM:SS' → 'YYYY-MM-DD' (null when absent/malformed). */
export function exifCaptureDate(exif?: Record<string, unknown> | null): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
