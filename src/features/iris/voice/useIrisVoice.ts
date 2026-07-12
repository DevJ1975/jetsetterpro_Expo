// IRIS hands-free voice loop, ported from IRISVoiceController.swift.
//
//   listening → thinking → speaking → listening …  (until the user stops)
//
//   • listening — @react-native-voice/voice transcribes the mic. Each partial
//     result restarts a short silence timer; when it fires we end-point the
//     utterance (matching the iOS 1.2s silence cutoff).
//   • thinking  — the finalized transcript is handed to `onUtterance`, which
//     returns IRIS's reply text.
//   • speaking  — expo-speech reads the reply. The mic is fully released while
//     speaking so IRIS never transcribes herself (echo).
//   • loop      — when speech finishes, listening resumes automatically.
//
// A monotonic `runId` invalidates any in-flight async work the moment the user
// stops or the screen unmounts, so late callbacks (a trailing final result, a
// resolved reply, a TTS onDone) can never resurrect a torn-down loop.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { isVoiceSupported, nativeVoice, VoiceErrorEvent } from './nativeVoice';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const SILENCE_MS = 1200; // silence that ends an utterance (matches iOS)
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

  // All the loop logic lives in function declarations so they can reference each
  // other regardless of order (mutual recursion: finalize ↔ listen ↔ speak).
  // Guards read refs, so timers/promises captured by an earlier render stay
  // correct after re-renders.

  function startListening() {
    if (!nativeVoice) return;
    transcriptRef.current = '';
    setTranscript('');
    setPhase('listening');
    nativeVoice.start(LOCALE).catch(() => {
      halt('Couldn’t start listening. Check microphone permission.');
    });
  }

  function resumeListening(delayMs: number) {
    const myRun = runIdRef.current;
    setTimeout(() => {
      if (runIdRef.current !== myRun) return; // stopped during the delay
      startListening();
    }, delayMs);
  }

  function restartSilenceTimer() {
    clearSilence();
    silenceRef.current = setTimeout(() => {
      void finalize();
    }, SILENCE_MS);
  }

  async function finalize() {
    if (stateRef.current !== 'listening') return; // already ended / not listening
    clearSilence();
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
      // onStopped fires on Speech.stop() (user stop / barge-in) — those paths
      // drive their own transition, so do nothing here.
    });
  }

  function handleTranscript(text: string) {
    if (stateRef.current !== 'listening') return;
    if (text) {
      transcriptRef.current = text;
      setTranscript(text);
    }
    restartSilenceTimer();
  }

  function handleNativeEnd() {
    // The platform recognizer (common on Android) end-pointed before our silence
    // timer — finalize now with whatever we have.
    if (stateRef.current === 'listening') void finalize();
  }

  function handleError(e: VoiceErrorEvent) {
    if (stateRef.current !== 'listening') return;
    const code = String(e?.error?.code ?? '');
    const message = String(e?.error?.message ?? '');
    // "no match" / "no speech" (iOS 1110/203; Android codes 6 & 7) just mean
    // nothing was heard — keep listening, exactly like the iOS controller.
    const benign =
      /no match|no speech|1110|203|retry/i.test(code + ' ' + message) ||
      code.startsWith('6') ||
      code.startsWith('7');
    if (benign) {
      if (transcriptRef.current.trim()) void finalize();
      else resumeListening(400);
      return;
    }
    // Anything else (permissions, recognizer busy, audio failure) is fatal.
    halt('Voice stopped. Check microphone permission and try again.');
  }

  function halt(message: string | null) {
    runIdRef.current += 1; // invalidate every outstanding async continuation
    clearSilence();
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

  // Latest logic, called across the native-event boundary via a ref so the
  // registration effect runs exactly once.
  const handlersRef = useRef({ handleTranscript, handleNativeEnd, handleError });
  handlersRef.current = { handleTranscript, handleNativeEnd, handleError };

  useEffect(() => {
    if (!nativeVoice) return;
    nativeVoice.onSpeechPartialResults = (e) => handlersRef.current.handleTranscript(e?.value?.[0] ?? '');
    nativeVoice.onSpeechResults = (e) => handlersRef.current.handleTranscript(e?.value?.[0] ?? '');
    nativeVoice.onSpeechEnd = () => handlersRef.current.handleNativeEnd();
    nativeVoice.onSpeechError = (e) => handlersRef.current.handleError(e);
    return () => {
      runIdRef.current += 1;
      if (silenceRef.current) clearTimeout(silenceRef.current);
      Speech.stop();
      try {
        void nativeVoice?.destroy().then(() => nativeVoice?.removeAllListeners());
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
    Speech.stop();
    resumeListening(150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
