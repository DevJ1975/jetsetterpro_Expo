import { create } from 'zustand';

// Entitlement state. Real IAP arrives in the subscription/paywall phase
// (RevenueCat, reusing the iOS product IDs). For the beta, Pro is unlocked for
// every tester so all features are exercisable; flip the default to `false` and
// wire the store to the purchase result before GA.

interface SubscriptionState {
  isProReal: boolean;
  setProReal: (on: boolean) => void;
}

export const useSubscription = create<SubscriptionState>((set) => ({
  isProReal: true, // Beta: Pro unlocked for all testers.
  setProReal: (on) => set({ isProReal: on }),
}));

/** Whether the user is entitled to Pro features. */
export function useIsPro(): boolean {
  return useSubscription((s) => s.isProReal);
}
