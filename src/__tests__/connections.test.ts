import { assessConnection, estimateGateWalk } from '@/src/core/connections';

const iso = (min: number) => new Date(min * 60_000).toISOString();

describe('estimateGateWalk', () => {
  it('is short within the same terminal + concourse', () => {
    expect(estimateGateWalk({ terminal: '2', gate: 'B12' }, { terminal: '2', gate: 'B4' })).toBe(6);
  });
  it('is longer across concourses in the same terminal', () => {
    expect(estimateGateWalk({ terminal: '2', gate: 'B12' }, { terminal: '2', gate: 'A4' })).toBe(12);
  });
  it('is longest across terminals', () => {
    expect(estimateGateWalk({ terminal: '2', gate: 'B12' }, { terminal: '5', gate: 'A4' })).toBe(22);
  });
  it('falls back conservatively when gates are unknown', () => {
    expect(estimateGateWalk({}, {})).toBe(15);
  });
});

describe('assessConnection', () => {
  it('flags a generous layover as comfortable', () => {
    const a = assessConnection(iso(0), iso(90), { terminal: '2', gate: 'B12' }, { terminal: '2', gate: 'B4' });
    expect(a.verdict).toBe('comfortable');
    expect(a.layoverMinutes).toBe(90);
    expect(a.bufferMinutes).toBeGreaterThan(25);
  });
  it('flags a short cross-terminal layover as risky', () => {
    const a = assessConnection(iso(0), iso(35), { terminal: '2', gate: 'B12' }, { terminal: '5', gate: 'A4' });
    expect(a.verdict).toBe('risky');
    expect(a.sameTerminal).toBe(false);
    expect(a.advice.toLowerCase()).toContain('terminal');
  });
  it('flags a middling layover as tight', () => {
    // same terminal, diff concourse → transfer ≈ 37 min; a 50 min layover
    // leaves ~13 min slack → tight (not comfortable, not risky).
    const a = assessConnection(iso(0), iso(50), { terminal: '2', gate: 'B12' }, { terminal: '2', gate: 'A4' });
    expect(a.verdict).toBe('tight');
  });
});
