import React, { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { FLAP_ALPHABET, nextFlapChar, normalizeFlapChar } from './splitFlap';

/**
 * Solari-style split-flap text — port of iOS `SplitFlapText.swift`. Each
 * character cell spins through the flap alphabet before settling on its target,
 * staggered per column. The spin is driven by react-native-reanimated (a shared
 * progress value + `useAnimatedReaction` commits each character on the UI-thread
 * clock — no JS `setInterval`), with a subtle vertical "flap" squash. Honors
 * Reduce Motion by snapping straight to the target.
 */
export type SplitFlapTextProps = {
  text: string;
  characterWidth?: number;
  characterHeight?: number;
  fontSize?: number;
  tint?: string;
  background?: string;
  /** Staggered delay between adjacent characters (seconds, iOS default 0.05). */
  staggerDelay?: number;
  /** Time between flaps within one character (seconds, iOS default 0.045). */
  stepDuration?: number;
};

export default function SplitFlapText({
  text,
  characterWidth = 18,
  characterHeight = 26,
  fontSize = 18,
  tint = '#FFD60A',
  background = '#0F0F0F',
  staggerDelay = 0.05,
  stepDuration = 0.045,
}: SplitFlapTextProps) {
  return (
    <View style={styles.row}>
      {Array.from(text).map((char, index) => (
        <FlapCell
          key={index}
          target={normalizeFlapChar(char)}
          delayMs={index * staggerDelay * 1000}
          stepMs={stepDuration * 1000}
          width={characterWidth}
          height={characterHeight}
          fontSize={fontSize}
          tint={tint}
          background={background}
        />
      ))}
    </View>
  );
}

const FlapCell = memo(function FlapCell({
  target,
  delayMs,
  stepMs,
  width,
  height,
  fontSize,
  tint,
  background,
}: {
  target: string;
  delayMs: number;
  stepMs: number;
  width: number;
  height: number;
  fontSize: number;
  tint: string;
  background: string;
}) {
  const reduce = useReduceMotion();
  const [displayed, setDisplayed] = useState(' ');
  // Mirrors the rendered char so a new target re-spins from where it stopped.
  const displayedRef = useRef(' ');
  // The spin sequence stays on the JS thread (a ref); the worklets read only
  // numbers — `t` (0→1 progress), `seqLen`, and `spin` (a per-spin generation
  // that forces the reaction to re-fire when a new target starts even if the
  // end index is unchanged — e.g. equal-distance re-targets under Reduce Motion).
  const seqRef = useRef<string[]>([]);
  const seqLen = useSharedValue(0);
  const spin = useSharedValue(0);
  const t = useSharedValue(0);

  // Commit the spun character at index `i` on the JS thread.
  const commit = (i: number) => {
    const ch = seqRef.current[i];
    if (ch == null) return;
    displayedRef.current = ch;
    setDisplayed(ch);
  };

  useEffect(() => {
    if (displayedRef.current === target) return;
    // Build the flap sequence from the resting char to the target. Bounded by
    // the alphabet length — nextFlapChar cycles, so any pair is reachable.
    const chars: string[] = [];
    let c = displayedRef.current;
    for (let n = 0; n < FLAP_ALPHABET.length + 1 && c !== target; n++) {
      c = nextFlapChar(c);
      chars.push(c);
    }
    if (chars.length === 0) return;
    seqRef.current = chars;
    seqLen.value = chars.length;
    spin.value += 1; // new spin — makes the reaction re-fire on every re-target
    if (reduce) {
      // Snap: jump progress to the end so the reaction commits the target on
      // the next frame with no visible spin (avoids synchronous setState here).
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delayMs,
      withTiming(1, { duration: chars.length * stepMs, easing: Easing.linear }),
    );
    // commit + refs are stable; re-run only when the target/timing/RM changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, delayMs, stepMs, reduce]);

  // Advance the visible character from spin progress on the UI-thread clock. The
  // prepared value packs the spin generation with the clamped index (index is
  // always < 1000 — bounded by the flap alphabet), so a new spin never collides
  // with the last committed value even when the end index is identical.
  useAnimatedReaction(
    () => {
      const n = seqLen.value;
      if (n === 0) return -1;
      const raw = Math.floor(t.value * n);
      const i = raw < 0 ? 0 : raw > n - 1 ? n - 1 : raw;
      return spin.value * 1000 + i;
    },
    (curr, prev) => {
      if (curr >= 0 && curr !== prev) {
        runOnJS(commit)(curr % 1000);
      }
    },
    [],
  );

  // Subtle mechanical "flap": the cell squashes vertically between characters.
  const flapStyle = useAnimatedStyle(() => {
    const n = seqLen.value;
    if (n === 0) return { transform: [{ scaleY: 1 }] };
    const frac = (t.value * n) % 1;
    return { transform: [{ scaleY: 1 - 0.16 * Math.sin(frac * Math.PI) }] };
  });

  return (
    <View style={[styles.cell, { width, height, backgroundColor: background }]}>
      <Animated.Text
        style={[styles.char, { fontSize, color: tint, lineHeight: height }, flapStyle]}
        allowFontScaling={false}
      >
        {displayed}
      </Animated.Text>
      <View style={styles.split} pointerEvents="none" />
    </View>
  );
});

// Sanity: the alphabet drives max spin length; keep the import referenced for
// consumers that want it (board tests).
export { FLAP_ALPHABET };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1 },
  cell: {
    borderRadius: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontFamily: Platform.select({ ios: 'Menlo-Bold', android: 'monospace', default: 'monospace' }),
    fontWeight: Platform.OS === 'android' ? '700' : undefined,
    textAlign: 'center',
  },
  // Hairline split through the middle gives it the Solari aesthetic.
  split: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
