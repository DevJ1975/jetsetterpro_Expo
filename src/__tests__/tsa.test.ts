import { estimateSecurityWait } from '@/src/core/api/tsa';

describe('security wait estimate (labeled heuristic)', () => {
  const tue10am = new Date('2026-07-14T10:00:00'); // Tuesday, off-peak-ish
  const tue6am = new Date('2026-07-14T06:00:00'); // morning peak

  it('mega hubs wait longer than unknown airports', () => {
    const atl = estimateSecurityWait('ATL', tue10am, 'standard');
    const tiny = estimateSecurityWait('XNA', tue10am, 'standard');
    expect(atl.minutes).toBeGreaterThan(tiny.minutes);
  });

  it('PreCheck and CLEAR shrink the estimate', () => {
    const std = estimateSecurityWait('ATL', tue10am, 'standard');
    const pre = estimateSecurityWait('ATL', tue10am, 'preCheck');
    const clear = estimateSecurityWait('ATL', tue10am, 'clear');
    expect(pre.minutes).toBeLessThan(std.minutes);
    expect(clear.minutes).toBeLessThan(pre.minutes);
    expect(clear.minutes).toBeGreaterThanOrEqual(3); // floor
  });

  it('flags morning peak and inflates the estimate', () => {
    const peak = estimateSecurityWait('ORD', tue6am, 'standard');
    const off = estimateSecurityWait('ORD', tue10am, 'standard');
    expect(peak.peak).toBe(true);
    expect(peak.minutes).toBeGreaterThan(off.minutes);
  });

  it('always returns a sane range around the estimate', () => {
    const e = estimateSecurityWait('JFK', tue10am, 'standard');
    expect(e.range[0]).toBeLessThanOrEqual(e.minutes);
    expect(e.range[1]).toBeGreaterThanOrEqual(e.minutes);
    expect(e.confidence).toBe('estimate');
  });
});
