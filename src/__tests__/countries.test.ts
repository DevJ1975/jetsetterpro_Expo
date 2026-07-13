import { COUNTRIES, matchCountry, VISA_META } from '@/src/core/data/countries';

describe('matchCountry', () => {
  it('returns undefined for empty/undefined input', () => {
    expect(matchCountry(undefined)).toBeUndefined();
    expect(matchCountry('')).toBeUndefined();
  });

  it('matches a known city to its country', () => {
    expect(matchCountry('Tokyo, Japan')?.code).toBe('JP');
    expect(matchCountry('London')?.code).toBe('GB');
    expect(matchCountry('mexico city')?.code).toBe('MX');
  });

  it('is case-insensitive', () => {
    expect(matchCountry('PARIS')?.code).toBe('FR');
  });

  it('falls back to matching the country name when no city hits', () => {
    expect(matchCountry('somewhere in France')?.code).toBe('FR');
    expect(matchCountry('Germany')?.code).toBe('DE');
  });

  it('returns undefined when nothing matches', () => {
    expect(matchCountry('Narnia')).toBeUndefined();
  });
});

describe('COUNTRIES dataset', () => {
  it('has a VISA_META entry for every visa status used', () => {
    for (const c of COUNTRIES) {
      expect(VISA_META[c.visa.status]).toBeDefined();
    }
  });

  it('has unique country codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('carries the required essentials fields for each country', () => {
    for (const c of COUNTRIES) {
      expect(c.currency).toBeTruthy();
      expect(c.emergency).toBeTruthy();
      expect(c.phrases.hello).toBeTruthy();
    }
  });
});
