import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
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
import { syncFlightWatches } from '@/src/core/firebase/flightWatches';
import { reconcile } from '@/src/core/firebase/firestore';
import { registerForPush } from '@/src/core/services/push';
import { ErrorBoundary } from '@/src/features/common/ErrorBoundary';
// Side-effect import runs the env-gated Sentry init before the app renders.
import { navigationIntegration, Sentry } from '@/src/core/observability/sentry';
import { Splash, palette } from '@/src/ui';
import { fontAssets } from '@/src/ui/theme/fonts';

// Foreground notifications show as banners (parity with iOS alerts).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = { anchor: '(tabs)' };

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  // Register the navigation container so Sentry can attach route breadcrumbs +
  // performance spans (no-op when Sentry isn't configured).
  const navRef = useNavigationContainerRef();
  useEffect(() => {
    if (navRef) navigationIntegration.registerNavigationContainer(navRef);
  }, [navRef]);

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
            {/* Android 15 edge-to-edge: light nav-bar icons for the dark app
                (no-op on iOS). setBackgroundColorAsync is removed under
                edge-to-edge, so this declarative style is the supported path. */}
            <NavigationBar style="light" />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap is a safe no-op when init was skipped (no DSN), so it's always
// applied — it adds an error boundary + touch/perf instrumentation when active.
export default Sentry.wrap(RootLayout);

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

  // Backend bootstrap: anonymous-first sign-in, then reconcile local ⇄ cloud,
  // then register push + mirror upcoming flights for the disruption watcher.
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
          // Honor the persisted flight-alerts opt-out — re-registering
          // unconditionally would silently revert a user's "off" on every launch.
          if (usePreferences.getState().flightAlerts !== false) void registerForPush();
          void syncFlightWatches(merged.trips);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // Disruption push taps deep-link into the dashboard.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as never);
      }
    });
    return () => sub.remove();
  }, [router]);

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
        <Stack.Screen name="add-bag" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-document" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-parking" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-identity" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-loyalty" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-wallet" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
      {!splashDone ? <Splash onDone={() => setSplashDone(true)} /> : null}
    </>
  );
}
