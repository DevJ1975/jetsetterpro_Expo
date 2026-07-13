import { BASE_INSTRUCTIONS, instructionsForCurrentUser } from '@/src/core/ai/iris/personality';

describe('instructionsForCurrentUser', () => {
  it('returns the base instructions unchanged when the memory summary is empty', () => {
    expect(instructionsForCurrentUser('')).toBe(BASE_INSTRUCTIONS);
  });

  it('appends the "WHAT YOU KNOW" block exactly once for a non-empty summary', () => {
    const out = instructionsForCurrentUser('- Dietary: vegetarian');
    expect(out.startsWith(BASE_INSTRUCTIONS)).toBe(true);
    expect(out).toContain('WHAT YOU KNOW ABOUT THIS TRAVELER');
    expect(out).toContain('- Dietary: vegetarian');
    expect(out.match(/WHAT YOU KNOW ABOUT THIS TRAVELER/g)).toHaveLength(1);
  });
});
