// Thin, defensively-loaded wrapper around @react-native-voice/voice.
//
// The native STT module only exists in a dev/production build (it needs the
// microphone + speech-recognition native code). In Expo Go, on web, or during
// `expo export` (JS-only bundling) it is absent — so we `require` it lazily
// inside a try/catch and expose `isVoiceSupported`. The rest of the app can
// then feature-detect voice instead of crashing at import time.

import { Platform } from 'react-native';

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
if (Platform.OS === 'ios' || Platform.OS === 'android') {
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
