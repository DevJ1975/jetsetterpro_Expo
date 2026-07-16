import { getApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';

// Firebase web config for the `jetsetter-pro` project (derived from
// google-services.json). Firebase API keys are client-PUBLIC by design — they
// identify the project, they are not secrets; access is enforced by Firestore
// Security Rules + (optionally) App Check. So these are safe to ship, like a
// Supabase anon key. Override any value via EXPO_PUBLIC_FIREBASE_* env vars.
//
// Firebase issues a distinct `appId` per platform app in a project. Auth +
// Firestore work with either, but App Check / Analytics want the platform's own
// id. iOS falls back to the Android id (from google-services.json) until an iOS
// app is registered and EXPO_PUBLIC_FIREBASE_IOS_APP_ID is set. Register a Web
// app for a web-specific id if you later want web Analytics.
const ANDROID_APP_ID =
  process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID ??
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
  '1:857695467541:android:7748dca7c1b22e7b60f61c';
const IOS_APP_ID = process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID ?? ANDROID_APP_ID;

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBEQBnjhDKGvmkYIxN3aPtNR6WlnC6WBrU',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'jetsetter-pro.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'jetsetter-pro',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'jetsetter-pro.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '857695467541',
  appId: Platform.OS === 'ios' ? IOS_APP_ID : ANDROID_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export function isFirebaseConfigured(): boolean {
  return (
    !!firebaseConfig.apiKey &&
    !!firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('YOUR_')
  );
}

// Live IRIS calls the `aiIris` Cloud Function (holds the Anthropic key). Until
// it's deployed and this endpoint is set, IRIS uses the built-in demo responses.
export const aiEndpoint = process.env.EXPO_PUBLIC_AI_ENDPOINT ?? '';
export function isAiConfigured(): boolean {
  return isFirebaseConfigured() && aiEndpoint.length > 0;
}
