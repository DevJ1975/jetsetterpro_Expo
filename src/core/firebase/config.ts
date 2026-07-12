import { getApp, getApps, initializeApp } from 'firebase/app';

// Firebase web config for the `jetsetter-pro` project (derived from
// google-services.json). Firebase API keys are client-PUBLIC by design — they
// identify the project, they are not secrets; access is enforced by Firestore
// Security Rules + (optionally) App Check. So these are safe to ship, like a
// Supabase anon key. Override any value via EXPO_PUBLIC_FIREBASE_* env vars.
//
// NOTE: `appId` here is the Android app id from google-services.json. Auth +
// Firestore work with it via the JS SDK; register a Web app in the Firebase
// console if you later want a web-specific appId (Analytics, etc.).
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBEQBnjhDKGvmkYIxN3aPtNR6WlnC6WBrU',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'jetsetter-pro.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'jetsetter-pro',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'jetsetter-pro.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '857695467541',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:857695467541:android:7748dca7c1b22e7b60f61c',
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
