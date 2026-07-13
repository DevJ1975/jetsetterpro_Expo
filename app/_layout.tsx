import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { demoExpenses, demoTrips } from '@/src/core/demo/mockData';
import { queryClient } from '@/src/core/query';
import { usePreferences } from '@/src/core/store/preferences';
import { onAuthStateChanged } from 'firebase/auth';
import { useSession } from '@/src/core/store/session';
import { useTravel } from '@/src/core/store/travel';
import { auth, ensureSignedIn } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';
import { reconcile } from '@/src/core/firebase/firestore';
import { palette } from '@/src/ui';

export const unstable_settings = { anchor: '(tabs)' };

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: palette.ink } }}
          >
            <RootNavigator />
            <StatusBar style="light" />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function useHydrated(): boolean {
  const prefs = usePreferences((s) => s._hasHydrated);
  const travel = useTravel((s) => s._hasHydrated);
  return prefs && travel;
}

function RootNavigator() {
  const hydrated = useHydrated();
  const onboarded = usePreferences((s) => s.hasCompletedOnboarding);
  const demoMode = usePreferences((s) => s.demoMode);
  const segments = useSegments();
  const router = useRouter();

  // Backend bootstrap: seed demo data, anonymous-first sign-in, reconcile sync.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    (async () => {
      const travel = useTravel.getState();
      if (demoMode && travel.trips.length === 0 && travel.expenses.length === 0) {
        travel.setAll(demoTrips(), demoExpenses());
      }

      if (isFirebaseConfigured()) {
        const user = await ensureSignedIn();
        if (cancelled) return;
        useSession.getState().setFromUser(user);
        onAuthStateChanged(auth, (u) => useSession.getState().setFromUser(u));

        // Only merge cloud data into a real (non-demo) local store.
        if (user && !demoMode) {
          const cur = useTravel.getState();
          const merged = await reconcile(cur.trips, cur.expenses);
          if (!cancelled) useTravel.getState().setAll(merged.trips, merged.expenses);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, demoMode]);

  // Splash + onboarding gate.
  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!onboarded && !inOnboarding) router.replace('/onboarding');
    else if (onboarded && inOnboarding) router.replace('/');
    void SplashScreen.hideAsync();
  }, [hydrated, onboarded, segments, router]);

  if (!hydrated) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="feature/[slug]" />
      <Stack.Screen name="add-trip" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
