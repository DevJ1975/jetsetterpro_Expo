import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StorageKeys, zustandStorage } from '@/src/core/persistence/kv';

export type Appearance = 'system' | 'dark' | 'light';

interface PreferencesState {
  name: string;
  homeAirport: string;
  homeCurrency: string;
  appearance: Appearance;
  hasCompletedOnboarding: boolean;
  demoMode: boolean;
  _hasHydrated: boolean;
  setProfile: (
    p: Partial<Pick<PreferencesState, 'name' | 'homeAirport' | 'homeCurrency' | 'appearance'>>,
  ) => void;
  completeOnboarding: () => void;
  setDemoMode: (on: boolean) => void;
  reset: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      name: '',
      homeAirport: '',
      homeCurrency: 'USD',
      appearance: 'dark',
      hasCompletedOnboarding: false,
      // Mirrors iOS: DEBUG → demo data on first launch, Release → live.
      demoMode: __DEV__,
      _hasHydrated: false,
      setProfile: (p) => set(p),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setDemoMode: (on) => set({ demoMode: on }),
      reset: () =>
        set({
          name: '',
          homeAirport: '',
          homeCurrency: 'USD',
          appearance: 'dark',
          hasCompletedOnboarding: false,
        }),
    }),
    {
      name: StorageKeys.preferences,
      storage: zustandStorage,
      partialize: (s) => ({
        name: s.name,
        homeAirport: s.homeAirport,
        homeCurrency: s.homeCurrency,
        appearance: s.appearance,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        demoMode: s.demoMode,
      }),
      onRehydrateStorage: () => () => {
        usePreferences.setState({ _hasHydrated: true });
      },
    },
  ),
);
