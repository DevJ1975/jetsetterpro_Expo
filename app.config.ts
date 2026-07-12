import { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config layer: keeps everything static in app.json, then injects
// runtime secrets from the environment (EAS `env`/`.env`) into `extra` so the
// app can read them via `expo-constants`. The Supabase anon key is safe to ship
// (Row-Level Security keys off auth.uid()); do NOT put service-role keys here.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'JetSetter Pro',
  slug: config.slug ?? 'jetsetter-pro',
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
});
