import Constants from 'expo-constants';

// EXPO_PUBLIC_* vars are inlined by Metro; `extra` (from app.config.ts) is the
// fallback so EAS-injected config also works.
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '',
};

/** True only when real Supabase credentials are present (mirrors the iOS
 *  `AppSecrets.isConfigured` switch that gates live-vs-demo behavior). */
export function isSupabaseConfigured(): boolean {
  return (
    env.supabaseUrl.length > 0 &&
    env.supabaseAnonKey.length > 0 &&
    !env.supabaseUrl.includes('YOUR_') &&
    !env.supabaseAnonKey.includes('YOUR_')
  );
}
