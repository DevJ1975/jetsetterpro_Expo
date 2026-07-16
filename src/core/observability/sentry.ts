import { isRunningInExpoGo } from 'expo';
import * as Sentry from '@sentry/react-native';

// Crash + error reporting, fully env-gated. With no EXPO_PUBLIC_SENTRY_DSN set,
// Sentry.init is never called and Sentry.wrap is a safe no-op, so the app runs
// exactly as before — nothing is sent anywhere. The owner activates it by
// setting the DSN (and, for readable stack traces, the sourcemap upload config
// in app.config.ts via SENTRY_ORG/SENTRY_PROJECT at build time).
//
// Note: native crash capture needs a dev/EAS build — the native SDK does not
// run in Expo Go (JS errors are still captured there).

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryEnabled = !!dsn;

// Created at module scope so the root layout can register the navigation
// container ref for route breadcrumbs/performance. expo-router uses
// react-navigation underneath, so this is the correct integration.
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV ?? (__DEV__ ? 'development' : 'production'),
    // Performance sampling — full in dev, light in production.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    sendDefaultPii: false,
    integrations: [navigationIntegration],
  });
}

export { Sentry };
