import React, { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FLAP_ALPHABET, nextFlapChar, normalizeFlapChar } from './splitFlap';

/**
 * Solari-style split-flap text — port of iOS `SplitFlapText.swift`. Each
 * character cell cycles through the flap alphabet before settling on its
 * target, with a staggered start per column. Used by the departure board.
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
  const [displayed, setDisplayed] = useState(' ');
  // Written only inside timer callbacks; carries the resting character across
  // target changes so a status update re-spins from where the cell stopped.
  const displayedRef = useRef(' ');

  useEffect(() => {
    if (displayedRef.current === target) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        const next = nextFlapChar(displayedRef.current);
        displayedRef.current = next;
        setDisplayed(next);
        if (next === target && interval) clearInterval(interval);
      }, stepMs);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
    // Re-run only when the target changes (status updates re-spin the cell).
  }, [target, delayMs, stepMs]);

  return (
    <View style={[styles.cell, { width, height, backgroundColor: background }]}>
      <Text
        style={[styles.char, { fontSize, color: tint, lineHeight: height }]}
        allowFontScaling={false}
      >
        {displayed}
      </Text>
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
