import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

/**
 * Count-up number — port of iOS `AnimatedCounter.swift`. Eases from the
 * previously shown value to `target` with an ease-out cubic (iOS counts from
 * 0 on appear; on later target changes we glide from the current value, the
 * RN analog of `.contentTransition(.numericText())`).
 */
export type CounterFormat =
  | 'integer'
  | { decimal: number }
  | { currency: string };

export function formatCounterValue(value: number, format: CounterFormat): string {
  if (format === 'integer') return Math.round(value).toLocaleString('en-US');
  if ('decimal' in format) return value.toFixed(format.decimal);
  return `${format.currency} ${value.toFixed(2)}`;
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

  useEffect(() => {
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
  }, [target, duration]);

  return <Text style={style}>{formatCounterValue(display, format)}</Text>;
}
