import { evaluateSuggestions, extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { makeFlight, makeTrip } from './_fixtures';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const notCheckedIn = () => false;
const kinds = (s: ReturnType<typeof evaluateSuggestions>) => s.map((x) => x.kind);

describe('extractFlightNumber', () => {
  it('extracts an airline code + number from a title', () => {
    expect(extractFlightNumber('AA100 to CDG')).toBe('AA100');
    expect(extractFlightNumber('Lufthansa LH400')).toBe('LH400');
  });

  it('is case-insensitive', () => {
    expect(extractFlightNumber('ba2490 nonstop')).toBe('BA2490');
  });

  it('returns null when there is no adjacent code+number', () => {
    expect(extractFlightNumber('United 456')).toBeNull();
    expect(extractFlightNumber('Morning flight')).toBeNull();
  });
});

describe('evaluateSuggestions', () => {
  it('surfaces a check-in nudge when the next flight departs within 24h', () => {
    const trips = [
      makeTrip({
        startDate: '2026-08-04',
        endDate: '2026-08-12',
        items: [makeFlight({ title: 'AA100 to CDG', startDate: '2026-08-04T06:00:00.000Z' })],
      }),
    ];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    const checkIn = out.find((s) => s.kind === 'checkInWindow');
    expect(checkIn).toBeDefined();
    expect(checkIn?.promptToIRIS).toBe('Check me in for AA100.');
    expect(checkIn?.dismissalKey).toBe('checkin-AA100');
  });

  it('does NOT nudge check-in when already checked in for that flight', () => {
    const trips = [
      makeTrip({
        startDate: '2026-08-04',
        endDate: '2026-08-12',
        items: [makeFlight({ title: 'AA100 to CDG', startDate: '2026-08-04T06:00:00.000Z' })],
      }),
    ];
    const out = evaluateSuggestions(trips, (fn) => fn === 'AA100', NOW);
    expect(kinds(out)).not.toContain('checkInWindow');
  });

  it('does NOT nudge check-in when the flight is more than 24h away', () => {
    const trips = [
      makeTrip({
        startDate: '2026-08-06',
        endDate: '2026-08-12',
        items: [makeFlight({ title: 'AA100', startDate: '2026-08-06T09:00:00.000Z' })],
      }),
    ];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    expect(kinds(out)).not.toContain('checkInWindow');
  });

  it('nudges packing for a trip 14–28 days out with no packing list', () => {
    const trips = [makeTrip({ destination: 'Rome', startDate: '2026-08-23', endDate: '2026-08-28' })];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    const packing = out.find((s) => s.kind === 'packingNudge');
    expect(packing).toBeDefined();
    expect(packing?.title).toContain('Rome');
  });

  it('does NOT nudge packing when a list already exists', () => {
    const trips = [
      makeTrip({
        startDate: '2026-08-23',
        endDate: '2026-08-28',
        packingList: [{ id: 'p1', label: 'Passport', packed: false }],
      }),
    ];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    expect(kinds(out)).not.toContain('packingNudge');
  });

  it('watches the weather for a trip departing within 3 days', () => {
    const trips = [makeTrip({ destination: 'Berlin', startDate: '2026-08-05', endDate: '2026-08-09' })];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    expect(kinds(out)).toContain('weatherWatch');
  });

  it('offers a daily briefing while a trip is active', () => {
    const trips = [makeTrip({ name: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10' })];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    const briefing = out.find((s) => s.kind === 'dailyBriefing');
    expect(briefing).toBeDefined();
    // The dismissal key is scoped to the current day so it re-surfaces daily.
    expect(briefing?.dismissalKey).toContain('2026-08-03');
  });

  it('welcomes the traveler home for a trip that just ended', () => {
    const trips = [makeTrip({ name: 'Lisbon', startDate: '2026-07-28', endDate: '2026-08-03' })];
    const out = evaluateSuggestions(trips, notCheckedIn, NOW);
    expect(kinds(out)).toContain('welcomeHome');
  });

  it('returns an empty list when there is nothing to nudge', () => {
    expect(evaluateSuggestions([], notCheckedIn, NOW)).toEqual([]);
  });
});
