import { parseRoute, phaseOf } from '@/src/core/flightPhase';

describe('parseRoute', () => {
  it('parses IATA pairs with →, ->, or "to"', () => {
    expect(parseRoute('JFK → LAX')).toEqual({ origin: 'JFK', dest: 'LAX' });
    expect(parseRoute('sfo -> nrt')).toEqual({ origin: 'SFO', dest: 'NRT' });
    expect(parseRoute('BOS to SEA')).toEqual({ origin: 'BOS', dest: 'SEA' });
  });

  it('returns empty codes for a non-matching title', () => {
    expect(parseRoute('Morning flight')).toEqual({ origin: '', dest: '' });
  });
});

describe('phaseOf', () => {
  it('labels each phase at representative progress points', () => {
    expect(phaseOf(0.0).label).toBe('Taxi & Takeoff');
    expect(phaseOf(0.1).label).toBe('Climb');
    expect(phaseOf(0.5).label).toBe('Cruise');
    expect(phaseOf(0.85).label).toBe('Descent');
    expect(phaseOf(0.97).label).toBe('Final approach');
  });

  it('hits cruise altitude (35000 ft) across the middle of the flight', () => {
    expect(phaseOf(0.5).alt).toBe(35000);
  });

  it('descends monotonically from cruise to 0 — no altitude jump (regression)', () => {
    // Sweep the whole flight; once at cruise, altitude must never increase again.
    let prev = Infinity;
    let peaked = false;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const alt = phaseOf(Math.min(1, p)).alt;
      if (peaked) expect(alt).toBeLessThanOrEqual(prev + 1); // allow rounding, forbid a real climb
      if (alt >= 35000) peaked = true; // flip AFTER asserting, so the climb→cruise step isn't flagged
      prev = alt;
    }
  });

  it('descent lands at ~5000 ft by the final-approach boundary (not ~0)', () => {
    expect(phaseOf(0.9499).alt).toBeGreaterThan(4000); // was ~0 before the fix
    expect(phaseOf(0.95).alt).toBe(5000);
    expect(phaseOf(1.0).alt).toBe(0);
  });
});
