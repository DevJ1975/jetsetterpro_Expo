// IRIS hands-free voice loop, ported from IRISVoiceController.swift.
//
//   listening → thinking → speaking → listening …  (until the user stops)
//
//   • listening — @react-native-voice/voice transcribes the mic. Each partial
//     result restarts a short silence timer; when it fires we end-point the
//     utterance (matching the iOS 1.2s silence cutoff). On Android the platform
//     recognizer end-points itself (onSpeechEnd), so we finalize on a short
//     grace window that still captures the trailing authoritative result.
//   • thinking  — the finalized transcript is handed to `onUtterance`, which
//     returns IRIS's reply text.
//   • speaking  — expo-speech reads the reply. The mic is fully released while
//     speaking so IRIS never transcribes herself (echo).
//   • loop      — when speech finishes, listening resumes automatically.
//
// A monotonic `runId` invalidates any in-flight async work the moment the user
// stops, barges in, backgrounds the app, or unmounts, so late callbacks (a
// trailing final result, a resolved reply, a TTS onDone, a stale start()
// rejection) can never resurrect a torn-down loop.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { isVoiceSupported, nativeVoice, VoiceErrorEvent } from './nativeVoice';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const SILENCE_MS = 1200; // silence that ends an utterance (matches iOS)
const END_GRACE_MS = 350; // after a native end-of-speech, wait this long for the final result
const RETRY_MS = 500; // backoff before re-listening after a transient error
const MAX_ERROR_STREAK = 4; // consecutive transient failures before we give up
const LOCALE = 'en-US';

/** Strip the light markdown IRIS emits so TTS doesn't read "asterisk". */
function speakable(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[*_`#>]/g, '')
    .trim();
}

export interface IrisVoice {
  state: VoiceState;
  transcript: string;
  status: string | null;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
  interruptSpeaking: () => void;
}

/**
 * @param onUtterance finalized transcript → IRIS reply text (empty/null = just
 *   resume listening without speaking).
 */
export function useIrisVoice(onUtterance: (text: string) => Promise<string | null>): IrisVoice {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const stateRef = useRef<VoiceState>('idle');
  const transcriptRef = useRef('');
  const runIdRef = useRef(0);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false); // native recognizer already end-pointed (Android)
  const errorStreakRef = useRef(0); // consecutive transient failures

  // Keep the latest onUtterance without re-registering native listeners.
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const setPhase = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const clearSilence = useCallback(() => {
    if (silenceRef.current) {
      clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  }, []);

  // Loop logic lives in function declarations so they can reference each other
  // regardless of order (mutual recursion: finalize ↔ listen ↔ speak). Guards
  // read refs, so timers/promises captured by an earlier render stay correct
  // after re-renders.

  function startListening() {
    if (!nativeVoice) return;
    const myRun = runIdRef.current;
    clearSilence(); // never carry an armed end-pointer into a fresh listen
    endedRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    setPhase('listening');
    nativeVoice.start(LOCALE).catch(() => {
      if (runIdRef.current !== myRun) return; // stale rejection — ignore
      // A start() failure is usually transient on Android (recognizer busy
      // during stop/start churn). Retry a bounded number of times.
      transientTrouble('Couldn’t start the microphone. Tap the mic to try again.');
    });
  }

  function resumeListening(delayMs: number) {
    const myRun = runIdRef.current;
    setTimeout(() => {
      if (runIdRef.current !== myRun) return; // stopped during the delay
      startListening();
    }, delayMs);
  }

  /** Arm the end-pointer: short window once the recognizer has ended, else the
   *  full silence cutoff. */
  function armFinalize() {
    clearSilence();
    const ms = endedRef.current ? END_GRACE_MS : SILENCE_MS;
    silenceRef.current = setTimeout(() => {
      void finalize();
    }, ms);
  }

  async function finalize() {
    if (stateRef.current !== 'listening') return; // already ended / not listening
    clearSilence();
    endedRef.current = false;
    errorStreakRef.current = 0;
    setPhase('thinking'); // block re-entry immediately
    const text = transcriptRef.current.trim();
    const myRun = runIdRef.current;

    // Release the mic (a trailing final result is ignored — state is no longer
    // 'listening'), then think.
    try {
      await nativeVoice?.stop();
    } catch {
      // ignore — best-effort mic release
    }
    if (runIdRef.current !== myRun) return; // user stopped meanwhile

    if (!text) {
      startListening(); // nothing heard — keep the loop alive
      return;
    }
    transcriptRef.current = '';
    setTranscript('');

    let reply: string | null = null;
    try {
      reply = await onUtteranceRef.current(text);
    } catch {
      reply = null;
    }
    if (runIdRef.current !== myRun) return; // user stopped while thinking

    const toSpeak = speakable(reply ?? '');
    if (toSpeak) speak(toSpeak, myRun);
    else resumeListening(250);
  }

  function speak(text: string, myRun: number) {
    setPhase('speaking');
    Speech.stop();
    Speech.speak(text, {
      language: LOCALE,
      onDone: () => {
        if (runIdRef.current === myRun) resumeListening(150);
      },
      onError: () => {
        if (runIdRef.current === myRun) resumeListening(150);
      },
      // onStopped fires on Speech.stop() (user stop / barge-in). Those paths bump
      // runId and drive their own transition, so nothing to do here.
    });
  }

  function handleTranscript(text: string) {
    if (stateRef.current !== 'listening') return;
    if (text) {
      transcriptRef.current = text;
      setTranscript(text);
      errorStreakRef.current = 0;
    }
    armFinalize();
  }

  function handleNativeEnd() {
    // The platform recognizer (common on Android) end-pointed before our silence
    // timer. Finalize on a short grace window so a trailing final onSpeechResults
    // can still land and overwrite the last partial.
    if (stateRef.current !== 'listening') return;
    endedRef.current = true;
    armFinalize();
  }

  function handleError(e: VoiceErrorEvent) {
    if (stateRef.current !== 'listening') return;
    clearSilence(); // cancel any armed end-pointer before we re-listen or halt
    const code = String(e?.error?.code ?? '');
    const message = String(e?.error?.message ?? '');
    const blob = (code + ' ' + message).toLowerCase();

    // Only a genuine permission denial is fatal — otherwise we'd re-prompt in a
    // loop. Everything else (no-speech, no-match, recognizer busy, transient
    // network/client errors during stop/start churn) just re-listens.
    if (/permission|denied|not[-_ ]?allowed|insufficient|authoriz/.test(blob) || code === '9') {
      halt('Microphone permission is needed for voice. Enable it in Settings, then tap the mic.');
      return;
    }
    // Heard something already — finalize with it rather than discarding.
    if (transcriptRef.current.trim()) {
      void finalize();
      return;
    }
    transientTrouble('I’m having trouble hearing you. Tap the mic to try again.');
  }

  /** Bounded retry: re-listen after a short backoff; give up after too many
   *  consecutive failures so a persistent fault can't spin forever. */
  function transientTrouble(giveUpMessage: string) {
    errorStreakRef.current += 1;
    if (errorStreakRef.current >= MAX_ERROR_STREAK) {
      halt(giveUpMessage);
      return;
    }
    resumeListening(RETRY_MS);
  }

  function halt(message: string | null) {
    runIdRef.current += 1; // invalidate every outstanding async continuation
    clearSilence();
    endedRef.current = false;
    errorStreakRef.current = 0;
    try {
      void nativeVoice?.cancel(); // discard, don't finalize
    } catch {
      // ignore
    }
    Speech.stop();
    transcriptRef.current = '';
    setTranscript('');
    setStatus(message);
    setPhase('idle');
  }

  // Latest logic, reached across the native-event / AppState boundary via refs
  // so the registration effect runs exactly once.
  const handlersRef = useRef({ handleTranscript, handleNativeEnd, handleError });
  handlersRef.current = { handleTranscript, handleNativeEnd, handleError };
  const haltRef = useRef(halt);
  haltRef.current = halt;

  useEffect(() => {
    // Stop the loop when the app leaves the foreground so the mic never records
    // in the background.
    const appSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && stateRef.current !== 'idle') haltRef.current(null);
    });

    if (!nativeVoice) {
      return () => appSub.remove();
    }
    nativeVoice.onSpeechPartialResults = (e) => handlersRef.current.handleTranscript(e?.value?.[0] ?? '');
    nativeVoice.onSpeechResults = (e) => handlersRef.current.handleTranscript(e?.value?.[0] ?? '');
    nativeVoice.onSpeechEnd = () => handlersRef.current.handleNativeEnd();
    nativeVoice.onSpeechError = (e) => handlersRef.current.handleError(e);
    return () => {
      appSub.remove();
      runIdRef.current += 1;
      if (silenceRef.current) clearTimeout(silenceRef.current);
      Speech.stop();
      // Detach OUR listeners synchronously (before any remount re-registers),
      // then release the mic. Chaining removeAllListeners after an async
      // destroy() would strip a freshly-mounted instance's handlers.
      try {
        nativeVoice?.removeAllListeners();
        void nativeVoice?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const stop = useCallback(() => halt(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    if (!isVoiceSupported) {
      setStatus('Voice needs a development build with the microphone module.');
      return;
    }
    runIdRef.current += 1;
    errorStreakRef.current = 0;
    setStatus(null);
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    if (stateRef.current === 'idle') start();
    else stop();
  }, [start, stop]);

  const interruptSpeaking = useCallback(() => {
    if (stateRef.current !== 'speaking') return;
    runIdRef.current += 1; // invalidate the in-flight speak's onDone so it can't also re-listen
    Speech.stop();
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    transcript,
    status,
    supported: isVoiceSupported,
    toggle,
    stop,
    interruptSpeaking,
  };
}
