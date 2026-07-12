import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env, isSupabaseConfigured } from '@/src/core/env';

// One shared client. When credentials are absent we still construct a client
// against a harmless placeholder so imports never throw; every network path is
// guarded by `isSupabaseConfigured()` so nothing is actually sent.
export const supabase = createClient(
  isSupabaseConfigured() ? env.supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? env.supabaseAnonKey : 'public-anon-placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export { isSupabaseConfigured };

// Refresh tokens only while the app is foregrounded (Supabase RN guidance).
let appStateBound = false;
export function bindSupabaseAppState(): void {
  if (appStateBound || !isSupabaseConfigured()) return;
  appStateBound = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
