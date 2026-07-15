import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { queryClient } from '@/src/core/query';
import { usePreferences } from '@/src/core/store/preferences';
import { onAuthStateChanged } from 'firebase/auth';
import { useSession } from '@/src/core/store/session';
import { useTravel } from '@/src/core/store/travel';
import { auth, ensureSignedIn } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';
import { reconcile } from '@/src/core/firebase/firestore';
import { ErrorBoundary } from '@/src/features/common/ErrorBoundary';
import { Splash, palette } from '@/src/ui';
import { fontAssets } from '@/src/ui/theme/fonts';

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
            <ErrorBoundary>
              <RootNavigator />
            </ErrorBoundary>
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
  // Brand fonts register at runtime; `error` unblocks rather than strands the
  // splash (text falls back to the system face).
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  return prefs && travel && (fontsLoaded || fontError != null);
}

function RootNavigator() {
  const hydrated = useHydrated();
  const onboarded = usePreferences((s) => s.hasCompletedOnboarding);
  const segments = useSegments();
  const router = useRouter();
  // Animated brand splash (iOS SplashScreenView parity) plays once per cold
  // start, over the app, right after the native splash hides.
  const [splashDone, setSplashDone] = useState(false);

  // Backend bootstrap: anonymous-first sign-in, then reconcile local ⇄ cloud.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    (async () => {
      if (isFirebaseConfigured()) {
        const user = await ensureSignedIn();
        if (cancelled) return;
        useSession.getState().setFromUser(user);
        onAuthStateChanged(auth, (u) => useSession.getState().setFromUser(u));

        if (user) {
          const cur = useTravel.getState();
          const merged = await reconcile(cur.trips, cur.expenses);
          if (!cancelled) useTravel.getState().setAll(merged.trips, merged.expenses);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

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
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="feature/[slug]" />
        <Stack.Screen name="add-trip" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
      </Stack>
      {!splashDone ? <Splash onDone={() => setSplashDone(true)} /> : null}
    </>
  );
}
