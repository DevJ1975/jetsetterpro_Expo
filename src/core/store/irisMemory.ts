import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { makeId } from '@/src/core/format';

// Faithful port of the iOS IRISMemory: on-device travel-preference memory with
// exponential decay, single-valued-category supersession, and a prompt floor.
// Never leaves the device (privacy contract).

export type MemoryCategory =
  | 'dietary'
  | 'seating'
  | 'hotelStyle'
  | 'airlinePreference'
  | 'transportation'
  | 'destinations'
  | 'activities'
  | 'general';

export interface IrisPreference {
  id: string;
  category: MemoryCategory;
  value: string;
  createdAt: string; // ISO
  lastReinforcedAt: string; // ISO
  confidence: number; // 0..1, default 0.7
}

const HALF_LIFE_DAYS = 180;
const MAX_PREFERENCES = 200;
export const PROMPT_CONFIDENCE_FLOOR = 0.35;
const SINGLE_VALUED: MemoryCategory[] = ['dietary', 'seating', 'hotelStyle'];

export const CATEGORY_DISPLAY: Record<MemoryCategory, string> = {
  dietary: 'Dietary',
  seating: 'Seating',
  hotelStyle: 'Hotel Style',
  airlinePreference: 'Airline Preference',
  transportation: 'Transportation',
  destinations: 'Destinations',
  activities: 'Activities',
  general: 'General',
};

export const CATEGORY_ICON: Record<MemoryCategory, string> = {
  dietary: 'restaurant',
  seating: 'airplane',
  hotelStyle: 'bed',
  airlinePreference: 'airplane',
  transportation: 'car',
  destinations: 'globe',
  activities: 'sparkles',
  general: 'bookmark',
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

function matchKey(value: string): string {
  let k = value.toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
  k = k.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  if (k.length > 3 && k.endsWith('s')) k = k.slice(0, -1);
  return k;
}

export function effectiveConfidence(p: IrisPreference, now = Date.now()): number {
  const ageDays = Math.max(0, (now - new Date(p.lastReinforcedAt).getTime()) / 86_400_000);
  return p.confidence * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** The `What you remember about this user:` block injected into IRIS's system prompt. */
export function summaryForPrompt(prefs: IrisPreference[], now = Date.now()): string {
  const eligible = prefs.filter((p) => effectiveConfidence(p, now) >= PROMPT_CONFIDENCE_FLOOR);
  if (eligible.length === 0) return '';
  const byCat = new Map<MemoryCategory, IrisPreference[]>();
  for (const p of eligible) {
    const arr = byCat.get(p.category) ?? [];
    arr.push(p);
    byCat.set(p.category, arr);
  }
  const lines: string[] = [];
  for (const [cat, arr] of byCat) {
    arr.sort((a, b) => effectiveConfidence(b, now) - effectiveConfidence(a, now));
    lines.push(`- ${CATEGORY_DISPLAY[cat]}: ${arr.map((p) => p.value).join(', ')}`);
  }
  lines.sort();
  return `What you remember about this user:\n${lines.join('\n')}`;
}

function enforceCap(prefs: IrisPreference[], now = Date.now()): IrisPreference[] {
  if (prefs.length <= MAX_PREFERENCES) return prefs;
  return [...prefs]
    .sort((a, b) => {
      const d = effectiveConfidence(b, now) - effectiveConfidence(a, now);
      if (d !== 0) return d;
      return new Date(b.lastReinforcedAt).getTime() - new Date(a.lastReinforcedAt).getTime();
    })
    .slice(0, MAX_PREFERENCES);
}

// ── Store ────────────────────────────────────────────────────────────────────

interface IrisMemoryState {
  preferences: IrisPreference[];
  _hasHydrated: boolean;
  remember: (category: MemoryCategory, value: string) => void;
  remove: (id: string) => void;
  forgetEverything: () => void;
}

export const useIrisMemory = create<IrisMemoryState>()(
  persist(
    (set, get) => ({
      preferences: [],
      _hasHydrated: false,
      remember: (category, value) => {
        const normalized = value.trim();
        if (!normalized) return;
        const key = matchKey(normalized);
        const nowISO = new Date().toISOString();
        let prefs = [...get().preferences];

        // Single-valued supersession: decay conflicting values in the category.
        if (SINGLE_VALUED.includes(category)) {
          prefs = prefs.map((p) =>
            p.category === category && matchKey(p.value) !== key
              ? { ...p, confidence: Math.max(0, p.confidence - 0.3) }
              : p,
          );
        }

        // Reinforce an existing match, else insert.
        const idx = prefs.findIndex((p) => p.category === category && matchKey(p.value) === key);
        if (idx >= 0) {
          prefs[idx] = {
            ...prefs[idx],
            lastReinforcedAt: nowISO,
            confidence: Math.min(1, prefs[idx].confidence + 0.1),
          };
        } else {
          prefs.push({
            id: makeId(),
            category,
            value: normalized,
            createdAt: nowISO,
            lastReinforcedAt: nowISO,
            confidence: 0.7,
          });
          prefs = enforceCap(prefs);
        }
        set({ preferences: prefs });
      },
      remove: (id) => set({ preferences: get().preferences.filter((p) => p.id !== id) }),
      forgetEverything: () => set({ preferences: [] }),
    }),
    {
      name: 'iris_memory',
      storage: zustandStorage,
      partialize: (s) => ({ preferences: s.preferences }),
      onRehydrateStorage: () => () => {
        useIrisMemory.setState({ _hasHydrated: true });
      },
    },
  ),
);
