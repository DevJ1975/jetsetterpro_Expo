// Adapter exposing the old @react-native-voice/voice event/method surface (the
// `NativeVoice` interface) on top of the actively-maintained, New-Architecture-
// ready `expo-speech-recognition` — the official replacement now that
// @react-native-voice/voice is archived (read-only since Jan 2026).
//
// Keeping the same interface means the hands-free loop in `useIrisVoice.ts` is
// untouched.
//
// ⚠️ NOT VERIFIED ON DEVICE: expo-speech-recognition follows the Web Speech API
// event model, whose end-pointing/timing differs from the old library. The
// loop's silence (1200ms) and end-grace (350ms) windows in useIrisVoice.ts may
// need retuning once this can be exercised on a real build.
//
// Defensive load: the native module only exists in a dev/production build, so we
// require it inside try/catch — absence (Expo Go / web / bundling) degrades to
// `isVoiceSupported = false` instead of throwing.

import { Platform } from 'react-native';

/** Result payload shape (both partial and final), preserved from the old surface. */
export interface VoiceResultsEvent {
  value?: string[];
}

/** Error payload shape, preserved from the old surface. */
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

// The minimal typed slice of expo-speech-recognition the adapter touches.
interface ESRResult {
  results?: { transcript?: string }[];
  isFinal?: boolean;
}
interface ESRError {
  error?: string;
  message?: string;
  code?: number;
}
interface Subscription {
  remove(): void;
}
interface ESRModule {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  addListener(event: string, listener: (event: unknown) => void): Subscription;
}

let voice: NativeVoice | null = null;
let supported = false;

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition');
    const ESR: ESRModule | undefined = mod?.ExpoSpeechRecognitionModule;
    if (ESR && typeof ESR.start === 'function') {
      const adapter: NativeVoice = {
        async start(locale) {
          // The old library prompted on start(); expo-speech-recognition wants an
          // explicit request. Route a denial through onSpeechError so the loop's
          // permission handling halts (rather than retrying) as before.
          const perm = await ESR.requestPermissionsAsync();
          if (!perm.granted) {
            adapter.onSpeechError?.({
              error: { code: 'not-allowed', message: 'Speech recognition permission not granted.' },
            });
            return;
          }
          ESR.start({ lang: locale, interimResults: true, continuous: false, iosTaskHint: 'dictation' });
        },
        stop() {
          ESR.stop(); // stops and requests a final result
          return Promise.resolve();
        },
        cancel() {
          ESR.abort(); // stops without a final result
          return Promise.resolve();
        },
        destroy() {
          ESR.abort();
          return Promise.resolve();
        },
        // Clear the forwarded callbacks; the underlying subscriptions live for the
        // module's lifetime and simply no-op until useIrisVoice re-assigns them.
        removeAllListeners() {
          adapter.onSpeechStart = undefined;
          adapter.onSpeechEnd = undefined;
          adapter.onSpeechResults = undefined;
          adapter.onSpeechPartialResults = undefined;
          adapter.onSpeechError = undefined;
        },
      };

      // Register the native listeners once; they forward to whatever callbacks
      // useIrisVoice currently has assigned (mirrors the old mutable-handler API).
      ESR.addListener('result', (e) => {
        const ev = e as ESRResult;
        const transcript = ev?.results?.[0]?.transcript ?? '';
        if (ev?.isFinal) adapter.onSpeechResults?.({ value: [transcript] });
        else adapter.onSpeechPartialResults?.({ value: [transcript] });
      });
      ESR.addListener('speechstart', () => adapter.onSpeechStart?.(undefined));
      ESR.addListener('end', () => adapter.onSpeechEnd?.(undefined));
      ESR.addListener('error', (e) => {
        const ev = e as ESRError;
        adapter.onSpeechError?.({
          error: { code: String(ev?.code ?? ev?.error ?? ''), message: String(ev?.message ?? '') },
        });
      });

      voice = adapter;
      supported = true;
    }
  } catch {
    voice = null;
    supported = false;
  }
}

export const nativeVoice = voice;
export const isVoiceSupported = supported;
