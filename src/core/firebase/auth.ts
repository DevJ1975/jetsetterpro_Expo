import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Auth,
  EmailAuthProvider,
  User,
  deleteUser,
  getAuth,
  // @ts-ignore — getReactNativePersistence is exported by the RN build of firebase/auth.
  getReactNativePersistence,
  initializeAuth,
  linkWithCredential,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseApp, isFirebaseConfigured } from './config';

// Anonymous-first auth (mirrors the iOS backend contract): usable immediately,
// cross-device sync without a forced login, and an email upgrade LINKS the same
// uid so existing Firestore data stays owned by the user.

let auth: Auth;
try {
  auth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (fast refresh) — reuse it.
  auth = getAuth(firebaseApp);
}
export { auth };

export async function ensureSignedIn(): Promise<User | null> {
  if (!isFirebaseConfigured()) return null;
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn('[auth] anonymous sign-in failed:', e);
    return null;
  }
}

/** Upgrade the current anonymous user to an email account (keeps the uid). */
export async function upgradeToEmail(email: string, password: string) {
  const user = auth.currentUser;
  if (user?.isAnonymous) {
    return linkWithCredential(user, EmailAuthProvider.credential(email, password));
  }
  // No anonymous session to upgrade — sign in instead.
  return signInWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

/** Account deletion — wipe the user's Firestore subtree, then delete the auth user.
 *  (Firebase deletes client-side; no privileged function needed.) */
export async function deleteAccount(wipeData: () => Promise<void>): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await wipeData();
  } catch (e) {
    console.warn('[auth] data wipe failed:', e);
  }
  if (auth.currentUser) {
    try {
      await deleteUser(auth.currentUser);
    } catch (e) {
      console.warn('[auth] deleteUser failed (may need recent re-auth):', e);
    }
  }
}
