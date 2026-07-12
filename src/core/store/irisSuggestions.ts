import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Dismissal set for proactive suggestions (RN analog of the iOS
// iris_dismissed_suggestions store, capped so it can't grow unbounded).

const MAX = 500;

interface IrisSuggestionsState {
  dismissed: string[];
  dismiss: (key: string) => void;
  isDismissed: (key: string) => boolean;
}

export const useIrisSuggestions = create<IrisSuggestionsState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      dismiss: (key) => {
        const next = [...get().dismissed.filter((k) => k !== key), key];
        set({ dismissed: next.slice(-MAX) });
      },
      isDismissed: (key) => get().dismissed.includes(key),
    }),
    { name: 'iris_dismissed_suggestions', storage: zustandStorage },
  ),
);
