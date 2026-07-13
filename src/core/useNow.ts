import { useEffect, useState } from 'react';

/**
 * A timestamp that refreshes on an interval so time-derived UI (countdowns,
 * flight progress) stays live — without reading the impure `Date.now()` during
 * render, which the React Compiler lint rules forbid. The initial value is
 * captured once in a lazy state initializer (allowed), then ticked from an
 * effect.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
