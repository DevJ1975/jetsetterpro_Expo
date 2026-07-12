import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './client';

// Anonymous-first auth (mirrors the iOS SupabaseService): the app is usable
// immediately, cross-device sync works without a forced login, and an email
// upgrade links the SAME uid so existing rows stay owned by the user.

export async function ensureSignedIn(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[auth] anonymous sign-in failed:', error.message);
    return null;
  }
  return anon.session ?? null;
}

/** Upgrade the current anonymous user to an email account (keeps the uid). */
export async function upgradeToEmail(email: string, password: string) {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user?.is_anonymous) {
    return supabase.auth.updateUser({ email, password });
  }
  return supabase.auth.signUp({ email, password });
}

export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}

/** App Store Guideline 5.1.1(v) account deletion — RLS-scoped row wipe, then the
 *  privileged `delete-account` Edge Function removes the auth user. */
export async function deleteAccount(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('expenses').delete().neq('id', '');
  await supabase.from('trips').delete().neq('id', '');
  try {
    await supabase.functions.invoke('delete-account');
  } catch (e) {
    console.warn('[auth] delete-account function failed:', e);
  }
  await supabase.auth.signOut();
}
