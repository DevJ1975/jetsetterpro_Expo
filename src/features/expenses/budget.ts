import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Per-trip spending budgets (home currency), keyed by trip id — the RN analog
// of the iOS CurrencyExpenseViewModel `budget`. Tiny and local-only.

interface BudgetState {
  budgets: Record<string, number>;
  /** Set (or clear, with undefined/NaN/≤0) the budget for a trip. */
  setBudget: (tripId: string, amount: number | undefined) => void;
}

export const useTripBudgets = create<BudgetState>()(
  persist(
    (set) => ({
      budgets: {},
      setBudget: (tripId, amount) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
            delete budgets[tripId];
          } else {
            budgets[tripId] = amount;
          }
          return { budgets };
        }),
    }),
    {
      name: 'jetsetter_trip_budgets',
      storage: zustandStorage,
      partialize: (s) => ({ budgets: s.budgets }),
    },
  ),
);
