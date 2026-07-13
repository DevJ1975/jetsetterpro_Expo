/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// irisMemory.ts creates a persisted zustand store on import → mock AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import {
  effectiveConfidence,
  summaryForPrompt,
  type IrisPreference,
} from '@/src/core/store/irisMemory';

const NOW = new Date('2026-08-01T00:00:00.000Z').getTime();
const DAY = 86_400_000;

const pref = (over: Partial<IrisPreference> = {}): IrisPreference => ({
  id: over.id ?? 'p',
  category: over.category ?? 'dietary',
  value: over.value ?? 'vegetarian',
  createdAt: over.createdAt ?? new Date(NOW).toISOString(),
  lastReinforcedAt: over.lastReinforcedAt ?? new Date(NOW).toISOString(),
  confidence: over.confidence ?? 0.7,
});

describe('effectiveConfidence', () => {
  it('returns the base confidence for a just-reinforced preference', () => {
    expect(effectiveConfidence(pref({ confidence: 0.8 }), NOW)).toBeCloseTo(0.8, 5);
  });

  it('halves the confidence after one 180-day half-life', () => {
    const p = pref({ confidence: 0.8, lastReinforcedAt: new Date(NOW - 180 * DAY).toISOString() });
    expect(effectiveConfidence(p, NOW)).toBeCloseTo(0.4, 5);
  });

  it('clamps a future reinforcement date to age 0 (never exceeds base)', () => {
    const p = pref({ confidence: 0.7, lastReinforcedAt: new Date(NOW + 10 * DAY).toISOString() });
    expect(effectiveConfidence(p, NOW)).toBeCloseTo(0.7, 5);
  });
});

describe('summaryForPrompt', () => {
  it('returns "" when nothing clears the confidence floor', () => {
    // 0.7 * 0.5^3 = 0.0875 < 0.35 floor.
    const stale = pref({ confidence: 0.7, lastReinforcedAt: new Date(NOW - 540 * DAY).toISOString() });
    expect(summaryForPrompt([stale], NOW)).toBe('');
  });

  it('groups eligible prefs by category under the header', () => {
    const out = summaryForPrompt(
      [
        pref({ id: '1', category: 'dietary', value: 'vegetarian', confidence: 0.9 }),
        pref({ id: '2', category: 'seating', value: 'aisle', confidence: 0.9 }),
      ],
      NOW,
    );
    expect(out).toContain('What you remember about this user:');
    expect(out).toContain('- Dietary: vegetarian');
    expect(out).toContain('- Seating: aisle');
  });

  it('orders values within a category by effective confidence, descending', () => {
    const out = summaryForPrompt(
      [
        pref({ id: '1', category: 'activities', value: 'low', confidence: 0.5 }),
        pref({ id: '2', category: 'activities', value: 'high', confidence: 0.95 }),
      ],
      NOW,
    );
    expect(out).toContain('- Activities: high, low');
  });
});
