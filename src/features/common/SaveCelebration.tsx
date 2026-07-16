import React, { useState } from 'react';
import { SuccessAnimation } from '@/src/ui';
import { useReduceMotion } from '@/src/core/useReduceMotion';

// Shared "quick-add" delight: a brief confetti success overlay after a save,
// then the caller's follow-up (usually router.back()). Reduce-motion gated —
// when the user prefers reduced motion, the overlay is skipped entirely and
// `finish()` runs immediately, so the save flow stays instant and calm.
export function useSaveCelebration() {
  const reduce = useReduceMotion();
  const [pending, setPending] = useState<null | {
    title: string;
    subtitle: string;
    reference?: string | null;
    onDone: () => void;
  }>(null);

  /** Celebrate a completed save, then run `onDone` (e.g. navigate back). */
  const celebrate = (opts: {
    title: string;
    subtitle: string;
    reference?: string | null;
    onDone: () => void;
  }) => {
    if (reduce) {
      opts.onDone();
      return;
    }
    setPending(opts);
  };

  const overlay = pending ? (
    <SuccessAnimation
      title={pending.title}
      subtitle={pending.subtitle}
      referenceNumber={pending.reference ?? null}
      onDismiss={() => {
        const done = pending.onDone;
        setPending(null);
        done();
      }}
    />
  ) : null;

  return { celebrate, overlay };
}
