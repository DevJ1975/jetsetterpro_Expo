import { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config layer over app.json. Everything static lives in app.json; this
// hook injects build-time values from the environment (EAS `env` / `.env`).
// Firebase client config is read directly from EXPO_PUBLIC_* vars (see
// src/core/firebase/config.ts).
//
// GOOGLE_MAPS_ANDROID_API_KEY: Google Maps SDK for Android key (map display is
// free on mobile SDKs). Set it in eas.json build env or .env.local; iOS uses
// Apple Maps and needs no key. Without it, Android builds succeed but map
// tiles render blank.
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';
  const plugins = (config.plugins ?? []).map((plugin) =>
    plugin === 'react-native-maps' && mapsKey
      ? (['react-native-maps', { androidGoogleMapsApiKey: mapsKey }] as const)
      : plugin,
  );

  // Sentry sourcemap-upload plugin — added only when the org/project slugs are
  // provided at build time, so prebuild stays clean for owners without a Sentry
  // project. The DSN is NOT here (it lives in EXPO_PUBLIC_SENTRY_DSN via
  // Sentry.init); this plugin only configures build-time symbol upload, itself
  // gated on SENTRY_AUTH_TOKEN. Runtime reporting works without it (traces are
  // just unsymbolicated until an auth token is provided).
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  if (sentryOrg && sentryProject) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        url: process.env.SENTRY_URL ?? 'https://sentry.io/',
        organization: sentryOrg,
        project: sentryProject,
      },
    ] as never);
  }

  return {
    ...config,
    name: config.name ?? 'JetSetter Pro',
    slug: config.slug ?? 'jetsetter-pro',
    plugins: plugins as ExpoConfig['plugins'],
  };
};
