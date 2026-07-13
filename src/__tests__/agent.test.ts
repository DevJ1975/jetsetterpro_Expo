/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// agent.ts imports the persisted irisMemory store → mock AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { composeGreeting } from '@/src/core/ai/iris/agent';

describe('composeGreeting', () => {
  it('greets a brand-new user with no preferences', () => {
    expect(composeGreeting(0)).toContain("I'm IRIS");
  });

  it('uses the singular "preference" for exactly one', () => {
    const g = composeGreeting(1);
    expect(g).toContain('1 preference');
    expect(g).not.toContain('1 preferences');
  });

  it('uses the plural "preferences" for more than one', () => {
    expect(composeGreeting(3)).toContain('3 preferences');
  });
});
