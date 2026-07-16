import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live "Reduce Motion" accessibility setting. Animations across the app gate on
 * this to snap to their final state instead of springing — a premium app honors
 * the user's motion preference everywhere, not just on the splash.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
