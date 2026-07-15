import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Persisted log of actions IRIS has taken on the user's behalf — the RN port of
// the iOS IntelligenceHistoryView "RECENT ACTIONS" feed. Local-first like the
// other stores; a Firestore mirror (intelligence_events) is a later phase.

export interface IntelAction {
  id: string;
  icon: string; // Ionicons name
  title: string;
  outcome: string;
  at: string; // ISO timestamp
}

interface IntelligenceState {
  actions: IntelAction[];
  /** When the store was first created — seed rows are dated relative to this. */
  seededAt: string;
  record: (action: IntelAction) => void;
  clear: () => void;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Plausible past actions shown on first run (mirrors the iOS demo history). */
function seedActions(installedAtMs: number): IntelAction[] {
  const at = (msAgo: number) => new Date(installedAtMs - msAgo).toISOString();
  return [
    {
      id: 'seed-gate-change',
      icon: 'swap-horizontal',
      title: 'Gate change detected',
      outcome: 'AA169 moved B22 → B14 · rebooked your ride to Terminal B',
      at: at(2 * HOUR),
    },
    {
      id: 'seed-check-in',
      icon: 'checkmark-circle',
      title: 'Check-in reminder',
      outcome: 'You checked into DL2241 BOS → ORD',
      at: at(1 * DAY),
    },
    {
      id: 'seed-leave-now',
      icon: 'car',
      title: 'Leave-now alert',
      outcome: 'Departed for BOS 12 min before the optimal window',
      at: at(2 * DAY),
    },
    {
      id: 'seed-rain-packing',
      icon: 'rainy',
      title: 'Rain at destination',
      outcome: 'Added a compact umbrella to your packing list',
      at: at(3 * DAY),
    },
    {
      id: 'seed-visa-check',
      icon: 'document-text',
      title: 'Visa check',
      outcome: 'Japan eVisa confirmed valid until 2027',
      at: at(7 * DAY),
    },
  ];
}

// Captured once at store creation (module init — never during render). On first
// launch the seeded state is persisted; on later launches `persist` rehydrates
// the stored history over it, so the seed dates stay fixed relative to install.
const installedAtMs = Date.now();

export const useIntelligence = create<IntelligenceState>()(
  persist(
    (set, get) => ({
      seededAt: new Date(installedAtMs).toISOString(),
      actions: seedActions(installedAtMs),
      record: (action) => set({ actions: [action, ...get().actions].slice(0, 50) }),
      clear: () => set({ actions: [] }),
    }),
    { name: 'jetsetter_intelligence_history', storage: zustandStorage },
  ),
);

/** "Just now" / "35m ago" / "2h ago" / "Yesterday" / "3d ago" / "1w ago".
 *  Pass `nowMs` explicitly (e.g. from useNow) so render stays pure. */
export function timeAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - Date.parse(iso));
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
