import { languageForCountry, LANGUAGES, PHRASE_LABELS } from '@/src/core/data/phrasebook';

describe('languageForCountry', () => {
  it('maps known country codes to their language', () => {
    expect(languageForCountry('ES')?.code).toBe('es');
    expect(languageForCountry('MX')?.code).toBe('es'); // Mexico → Spanish
    expect(languageForCountry('BR')?.code).toBe('pt'); // Brazil → Portuguese
    expect(languageForCountry('JP')?.code).toBe('ja');
  });

  it('returns undefined for missing, unknown, or wrong-case codes', () => {
    expect(languageForCountry(undefined)).toBeUndefined();
    expect(languageForCountry('ZZ')).toBeUndefined();
    expect(languageForCountry('es')).toBeUndefined(); // COUNTRY_LANG keys are uppercase
  });
});

describe('LANGUAGES dataset', () => {
  it('has every phrase line index-aligned to PHRASE_LABELS', () => {
    for (const lang of LANGUAGES) {
      expect(lang.lines).toHaveLength(PHRASE_LABELS.length);
      expect(lang.lines.every((l) => !!l.t)).toBe(true);
    }
  });
});
