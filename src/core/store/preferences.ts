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
  _hasHydrated: boolean;
  setProfile: (
    p: Partial<Pick<PreferencesState, 'name' | 'homeAirport' | 'homeCurrency' | 'appearance'>>,
  ) => void;
  completeOnboarding: () => void;
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
      _hasHydrated: false,
      setProfile: (p) => set(p),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
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
      }),
      onRehydrateStorage: () => () => {
        usePreferences.setState({ _hasHydrated: true });
      },
    },
  ),
);
