// Thin, defensively-loaded wrapper around @react-native-voice/voice.
//
// The native STT code only exists in a dev/production build. At runtime the JS
// singleton is created at first import and touches NativeModules.Voice /
// NativeEventEmitter — which throws where the native module is absent (Expo Go,
// web). We `require` it lazily inside a try/catch so that failure degrades to
// `isVoiceSupported = false` instead of crashing the app; the rest of the app
// feature-detects voice.
//
// Note this is a *runtime* guard, not a bundling one: the package must stay a
// declared dependency for Metro to resolve the module. `expo export` only
// bundles (it doesn't execute app code), so it never hits the require.

import { NativeModules, Platform } from 'react-native';

/** Result payload shape (both partial and final) from the native module. */
export interface VoiceResultsEvent {
  value?: string[];
}

/** Error payload shape from the native module. */
export interface VoiceErrorEvent {
  error?: { code?: string; message?: string };
}

/** The subset of the @react-native-voice/voice surface this app uses. */
export interface NativeVoice {
  start(locale: string, options?: Record<string, unknown>): Promise<unknown>;
  stop(): Promise<unknown>;
  cancel(): Promise<unknown>;
  destroy(): Promise<unknown>;
  removeAllListeners(): void;
  onSpeechStart?: (e: unknown) => void;
  onSpeechEnd?: (e: unknown) => void;
  onSpeechResults?: (e: VoiceResultsEvent) => void;
  onSpeechPartialResults?: (e: VoiceResultsEvent) => void;
  onSpeechError?: (e: VoiceErrorEvent) => void;
}

let voice: NativeVoice | null = null;
let supported = false;

// Native STT is iOS/Android-only. Guard the require so a missing native module
// (Expo Go / web / bundling) degrades to "unsupported" rather than throwing.
//
// The `NativeModules.Voice != null` check is load-bearing: the JS class always
// has a `.start` method, and on Android `new NativeEventEmitter(undefined)` does
// NOT throw when the native module is absent (unlike iOS). Without this check
// `isVoiceSupported` would be a false positive in Expo Go on Android.
if ((Platform.OS === 'ios' || Platform.OS === 'android') && NativeModules?.Voice != null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-voice/voice');
    const instance = (mod?.default ?? mod) as NativeVoice | undefined;
    if (instance && typeof instance.start === 'function') {
      voice = instance;
      supported = true;
    }
  } catch {
    voice = null;
    supported = false;
  }
}

export const nativeVoice = voice;
export const isVoiceSupported = supported;
