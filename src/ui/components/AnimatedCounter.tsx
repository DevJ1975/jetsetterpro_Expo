import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { formatMoney } from '@/src/core/format';
import { useReduceMotion } from '@/src/core/useReduceMotion';

/**
 * Count-up number — port of iOS `AnimatedCounter.swift`. Eases from the
 * previously shown value to `target` with an ease-out cubic (iOS counts from
 * 0 on appear; on later target changes we glide from the current value, the
 * RN analog of `.contentTransition(.numericText())`). Honors Reduce Motion
 * (renders the final value immediately). Digits are tabular so the value
 * doesn't reflow frame-to-frame.
 */
export type CounterFormat =
  | 'integer'
  | { decimal: number }
  | { currency: string };

export function formatCounterValue(value: number, format: CounterFormat): string {
  if (format === 'integer') return Math.round(value).toLocaleString();
  if ('decimal' in format) return value.toFixed(format.decimal);
  // Real currency: symbol + locale grouping via Intl (was "USD 1234.50").
  return formatMoney(value, format.currency);
}

export default function AnimatedCounter({
  target,
  duration = 1.0,
  format = 'integer',
  style,
}: {
  target: number;
  /** Seconds, like the iOS API. */
  duration?: number;
  format?: CounterFormat;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      // No animation — the render below shows `target` directly (no setState).
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = Date.now();
    const ms = Math.max(1, duration * 1000);
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      // Track the shown value from inside the loop so a target change mid-count
      // glides from wherever the number currently is.
      fromRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {formatCounterValue(reduceMotion ? target : display, format)}
    </Text>
  );
}
