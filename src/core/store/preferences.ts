import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StorageKeys, zustandStorage } from '@/src/core/persistence/kv';

export type Appearance = 'system' | 'dark' | 'light';
export type DistanceUnit = 'mi' | 'km';

/** Notification toggles (iOS SettingsView NOTIFICATIONS section). */
export type NotificationPrefKey = 'flightAlerts' | 'tripReminders' | 'weeklyExpenseReview';

/** IRIS learning consent — master switch plus per-source controls
 *  (iOS UserPreferences.learningEnabled / learnFrom*). */
export interface IrisLearningPrefs {
  master: boolean;
  checkIns: boolean;
  receipts: boolean;
  trips: boolean;
}

const DEFAULT_IRIS_LEARNING: IrisLearningPrefs = {
  master: true,
  checkIns: true,
  receipts: true,
  trips: true,
};

interface PreferencesState {
  name: string;
  homeAirport: string;
  homeCurrency: string;
  /** Traveler birthday ("MM-DD" or "YYYY-MM-DD") — powers the home celebration. */
  birthday: string;
  /** ISO date the last home occasion (birthday/holiday) was celebrated — so the
   *  confetti fires at most once per day. */
  lastCelebratedOn: string;
  appearance: Appearance;
  hasCompletedOnboarding: boolean;
  distanceUnit: DistanceUnit;
  flightAlerts: boolean;
  tripReminders: boolean;
  weeklyExpenseReview: boolean;
  irisLearning: IrisLearningPrefs;
  /** First-run IRIS learning opt-in card shown once (iOS hasSeenLearningPrompt). */
  hasSeenIrisLearningPrompt: boolean;
  _hasHydrated: boolean;
  setProfile: (
    p: Partial<
      Pick<PreferencesState, 'name' | 'homeAirport' | 'homeCurrency' | 'appearance' | 'birthday'>
    >,
  ) => void;
  markCelebrated: (isoDate: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setNotification: (key: NotificationPrefKey, on: boolean) => void;
  setIrisLearning: (patch: Partial<IrisLearningPrefs>) => void;
  markIrisLearningPromptSeen: () => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      name: '',
      homeAirport: '',
      homeCurrency: 'USD',
      birthday: '',
      lastCelebratedOn: '',
      appearance: 'dark',
      hasCompletedOnboarding: false,
      distanceUnit: 'mi',
      flightAlerts: true,
      tripReminders: true,
      weeklyExpenseReview: true,
      irisLearning: DEFAULT_IRIS_LEARNING,
      hasSeenIrisLearningPrompt: false,
      _hasHydrated: false,
      setProfile: (p) => set(p),
      markCelebrated: (isoDate) => set({ lastCelebratedOn: isoDate }),
      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setNotification: (key, on) => set({ [key]: on } as Partial<PreferencesState>),
      setIrisLearning: (patch) =>
        set((s) => ({ irisLearning: { ...s.irisLearning, ...patch } })),
      markIrisLearningPromptSeen: () => set({ hasSeenIrisLearningPrompt: true }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      reset: () =>
        set({
          name: '',
          homeAirport: '',
          homeCurrency: 'USD',
          birthday: '',
          lastCelebratedOn: '',
          appearance: 'dark',
          hasCompletedOnboarding: false,
          distanceUnit: 'mi',
          flightAlerts: true,
          tripReminders: true,
          weeklyExpenseReview: true,
          irisLearning: DEFAULT_IRIS_LEARNING,
          hasSeenIrisLearningPrompt: false,
        }),
    }),
    {
      name: StorageKeys.preferences,
      storage: zustandStorage,
      partialize: (s) => ({
        name: s.name,
        homeAirport: s.homeAirport,
        homeCurrency: s.homeCurrency,
        birthday: s.birthday,
        lastCelebratedOn: s.lastCelebratedOn,
        appearance: s.appearance,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        distanceUnit: s.distanceUnit,
        flightAlerts: s.flightAlerts,
        tripReminders: s.tripReminders,
        weeklyExpenseReview: s.weeklyExpenseReview,
        irisLearning: s.irisLearning,
        hasSeenIrisLearningPrompt: s.hasSeenIrisLearningPrompt,
      }),
      onRehydrateStorage: () => () => {
        usePreferences.setState({ _hasHydrated: true });
      },
    },
  ),
);
