import {
  FLAP_ALPHABET,
  flapDistance,
  nextFlapChar,
  normalizeFlapChar,
} from '@/src/ui/components/splitFlap';
import { formatCounterValue } from '@/src/ui/components/AnimatedCounter';

describe('split-flap stepping', () => {
  it('normalizes to the flap alphabet', () => {
    expect(normalizeFlapChar('a')).toBe('A');
    expect(normalizeFlapChar('7')).toBe('7');
    expect(normalizeFlapChar(':')).toBe(':');
    expect(normalizeFlapChar('é')).toBe(' '); // out-of-alphabet coerces to space
    expect(normalizeFlapChar('')).toBe(' ');
  });

  it('steps forward one flap and wraps at the end', () => {
    expect(nextFlapChar('A')).toBe('B');
    expect(nextFlapChar('Z')).toBe('0');
    const last = FLAP_ALPHABET[FLAP_ALPHABET.length - 1];
    expect(nextFlapChar(last)).toBe('A'); // wrap-around
  });

  it('walks the exact distance to the target (matches the iOS wrap-forward walk)', () => {
    expect(flapDistance('A', 'A')).toBe(0);
    expect(flapDistance('A', 'C')).toBe(2);
    // wrapping: from '9' (index 35) forward to 'A' (index 0)
    expect(flapDistance('9', 'A')).toBe(FLAP_ALPHABET.length - 35);
    // every char reaches every target in < alphabet length steps
    let current = normalizeFlapChar('B');
    const target = normalizeFlapChar('4');
    let steps = 0;
    while (current !== target && steps <= FLAP_ALPHABET.length) {
      current = nextFlapChar(current);
      steps += 1;
    }
    expect(current).toBe(target);
    expect(steps).toBe(flapDistance('B', '4'));
  });
});

describe('AnimatedCounter formatting', () => {
  it('formats integers with grouping', () => {
    expect(formatCounterValue(247830, 'integer')).toBe('247,830');
    expect(formatCounterValue(999.6, 'integer')).toBe('1,000');
  });
  it('formats decimals and currency', () => {
    expect(formatCounterValue(12.3456, { decimal: 2 })).toBe('12.35');
    expect(formatCounterValue(6715, { currency: 'USD' })).toBe('USD 6715.00');
  });
});
