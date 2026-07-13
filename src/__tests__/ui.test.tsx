import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
// Import via the typed barrel so props resolve to the declared (optional) types.
import { Badge, Button, Card, ProgressBar, palette } from '@/src/ui';

// react-test-renderer needs the initial render committed inside act() on React 19.
function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

type InnerFill = { children: { props: { style: { width: string } } }[] };

/** Render, then read the inner fill's width string (ProgressBar's inner View). */
function progressWidth(value: number): string {
  const json = render(<ProgressBar value={value} />).toJSON() as unknown as InnerFill;
  return json.children[0].props.style.width;
}

describe('ProgressBar clamp', () => {
  it('clamps into [0, 1] and maps to a percent width', () => {
    expect(progressWidth(0)).toBe('0%');
    expect(progressWidth(0.5)).toBe('50%');
    expect(progressWidth(1)).toBe('100%');
    expect(progressWidth(1.5)).toBe('100%'); // over-range clamps
    expect(progressWidth(-0.5)).toBe('0%'); // under-range clamps
  });

  it('guards NaN → 0% (regression for the unguarded width math)', () => {
    expect(progressWidth(NaN)).toBe('0%');
  });
});

describe('Card variant fallback', () => {
  it('uses the solid background for an unknown variant', () => {
    // Off-union variant (cast) to exercise the fallback added to Card.
    const json = render(<Card variant={'bogus' as never}>x</Card>).toJSON() as unknown as {
      props: { style: unknown };
    };
    const flat = StyleSheet.flatten(json.props.style) as { backgroundColor?: string };
    expect(flat.backgroundColor).toBe(palette.surface); // === the 'solid' background
  });
});

describe('tone/variant fallbacks never crash on an unknown key', () => {
  it('Badge falls back instead of dereferencing undefined', () => {
    // Without the `|| TONES.accent` fallback, an unknown tone throws on `t.bg`.
    expect(() => render(<Badge tone={'nope' as never} label="X" />)).not.toThrow();
  });

  it('Button falls back for unknown variant and size', () => {
    expect(() => render(<Button title="Go" variant={'nope' as never} size={'huge' as never} />)).not.toThrow();
  });
});
