import { estimateCompensation } from '@/src/core/services/compensation';

const eu = (over: Partial<Parameters<typeof estimateCompensation>[0]> = {}) =>
  estimateCompensation({ region: 'EU', distanceKm: 2000, delayHours: 3.5, ...over });

describe('estimateCompensation — EU261', () => {
  it('is not eligible for a sub-3h delay that is not a cancellation', () => {
    const r = eu({ delayHours: 2 });
    expect(r.eligible).toBe(false);
    expect(r.amount).toBeUndefined();
  });

  it('pays out for a cancellation even with no delay', () => {
    const r = eu({ delayHours: 0, cancelled: true });
    expect(r.eligible).toBe(true);
    expect(r.amount).toEqual({ value: 400, currency: 'EUR' });
  });

  it('pays €250 for short-haul (≤1500 km)', () => {
    expect(eu({ distanceKm: 1200 }).amount).toEqual({ value: 250, currency: 'EUR' });
  });

  it('treats 1500 km as short-haul (boundary is inclusive)', () => {
    expect(eu({ distanceKm: 1500 }).amount).toEqual({ value: 250, currency: 'EUR' });
  });

  it('pays €400 for medium-haul (1500–3500 km)', () => {
    expect(eu({ distanceKm: 2000 }).amount).toEqual({ value: 400, currency: 'EUR' });
    expect(eu({ distanceKm: 3500 }).amount).toEqual({ value: 400, currency: 'EUR' });
  });

  it('pays €600 for non-intra-EU long-haul (>3500 km) with a 4h+ delay', () => {
    expect(eu({ distanceKm: 4000, delayHours: 5 }).amount).toEqual({
      value: 600,
      currency: 'EUR',
    });
  });

  it('halves long-haul to €300 for a 3–4h delay (Art. 7(2))', () => {
    expect(eu({ distanceKm: 4000, delayHours: 3.5 }).amount).toEqual({
      value: 300,
      currency: 'EUR',
    });
  });

  it('does NOT halve a cancelled long-haul flight (cancellation is not a delay)', () => {
    expect(eu({ distanceKm: 4000, delayHours: 0, cancelled: true }).amount).toEqual({
      value: 600,
      currency: 'EUR',
    });
  });

  it('caps intra-EU long-haul at €400 regardless of distance (the intra-EU cap)', () => {
    expect(eu({ distanceKm: 5000, delayHours: 5, intraEu: true }).amount).toEqual({
      value: 400,
      currency: 'EUR',
    });
  });

  it('does not apply the halving to intra-EU flights', () => {
    // intraEu is capped at 400 and the 3–4h halving only targets non-intra >3500.
    expect(eu({ distanceKm: 5000, delayHours: 3.5, intraEu: true }).amount).toEqual({
      value: 400,
      currency: 'EUR',
    });
  });
});

describe('estimateCompensation — US DOT', () => {
  it('owes a refund for a cancellation but no fixed cash amount', () => {
    const r = estimateCompensation({ region: 'US', distanceKm: 3000, delayHours: 0, cancelled: true });
    expect(r.eligible).toBe(true);
    expect(r.amount).toBeUndefined();
  });

  it('is not eligible for a delay (no statutory cash compensation)', () => {
    const r = estimateCompensation({ region: 'US', distanceKm: 3000, delayHours: 6 });
    expect(r.eligible).toBe(false);
  });
});

describe('estimateCompensation — other regions', () => {
  it('has no statutory scheme', () => {
    const r = estimateCompensation({ region: 'other', distanceKm: 3000, delayHours: 6 });
    expect(r.eligible).toBe(false);
    expect(r.amount).toBeUndefined();
  });
});
