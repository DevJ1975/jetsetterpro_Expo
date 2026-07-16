import { occasionFor } from '@/src/features/home/occasions';

// Occasion detection for the home celebration — birthday + US holidays.
describe('occasionFor', () => {
  it('detects a fixed-date holiday', () => {
    expect(occasionFor(new Date('2026-07-04T09:00:00'))?.key).toBe('independence');
    expect(occasionFor(new Date('2026-12-25T09:00:00'))?.greeting).toBe('Merry Christmas');
  });

  it('returns null on an ordinary day', () => {
    expect(occasionFor(new Date('2026-08-03T09:00:00'))).toBeNull();
  });

  it('matches a birthday in MM-DD or YYYY-MM-DD form', () => {
    expect(occasionFor(new Date('2026-03-09T09:00:00'), '03-09')?.key).toBe('birthday');
    expect(occasionFor(new Date('2026-03-09T09:00:00'), '1985-03-09')?.key).toBe('birthday');
    expect(occasionFor(new Date('2026-03-10T09:00:00'), '03-09')).toBeNull();
  });

  it('lets the birthday win over a holiday on a shared day', () => {
    expect(occasionFor(new Date('2026-07-04T09:00:00'), '07-04')?.key).toBe('birthday');
  });

  it('computes floating US holidays for the given year', () => {
    // Thanksgiving 2026 = 4th Thursday of November = Nov 26.
    expect(occasionFor(new Date('2026-11-26T09:00:00'))?.key).toBe('thanksgiving');
    // Memorial Day 2026 = last Monday of May = May 25.
    expect(occasionFor(new Date('2026-05-25T09:00:00'))?.key).toBe('memorial');
    // Labor Day 2026 = first Monday of September = Sep 7.
    expect(occasionFor(new Date('2026-09-07T09:00:00'))?.key).toBe('labor');
  });

  it('ignores an unparseable birthday', () => {
    expect(occasionFor(new Date('2026-08-03T09:00:00'), 'not-a-date')).toBeNull();
  });
});
