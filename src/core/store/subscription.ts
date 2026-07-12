import { create } from 'zustand';
import { usePreferences } from './preferences';

// Entitlement state. Real IAP arrives in the subscription/paywall phase
// (RevenueCat, reusing the iOS product IDs); for now Pro is unlocked in demo
// mode, mirroring the iOS DEBUG demo-unlock.

interface SubscriptionState {
  isProReal: boolean;
  setProReal: (on: boolean) => void;
}

export const useSubscription = create<SubscriptionState>((set) => ({
  isProReal: false,
  setProReal: (on) => set({ isProReal: on }),
}));

/** Combined entitlement: demo mode OR a real Pro subscription. */
export function useIsPro(): boolean {
  const demo = usePreferences((s) => s.demoMode);
  const real = useSubscription((s) => s.isProReal);
  return demo || real;
}
