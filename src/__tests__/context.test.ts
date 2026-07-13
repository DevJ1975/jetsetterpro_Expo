import { composeFirstTurn, currentSnapshot } from '@/src/core/ai/iris/context';
import { makeExpense, makeFlight, makeTrip } from './_fixtures';

const NOW = new Date('2026-08-03T12:00:00.000Z');

describe('currentSnapshot', () => {
  it('returns an empty string for a brand-new user with no data', () => {
    expect(currentSnapshot([], [], NOW)).toBe('');
  });

  it('summarizes the active trip, next flight and expense totals', () => {
    const trips = [
      makeTrip({
        name: 'Paris Getaway',
        destination: 'Paris',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
        items: [
          makeFlight({ title: 'AA100', startDate: '2026-08-05T09:00:00.000Z', location: 'JFK' }),
        ],
      }),
    ];
    const expenses = [
      makeExpense({ amount: 50, currency: 'EUR' }),
      makeExpense({ amount: 20, currency: 'EUR' }),
    ];
    const snap = currentSnapshot(trips, expenses, NOW);
    expect(snap).toContain('Live traveler data');
    expect(snap).toContain('Current trip: Paris Getaway');
    expect(snap).toContain('✈ AA100');
    expect(snap).toContain('Next flight: AA100');
    expect(snap).toContain('Expenses logged: 2');
    expect(snap).toContain('70.00 EUR');
  });

  it('labels a future trip as the next trip, not the current one', () => {
    const trips = [
      makeTrip({ name: 'Future', startDate: '2026-09-01', endDate: '2026-09-10' }),
    ];
    const snap = currentSnapshot(trips, [], NOW);
    expect(snap).toContain('Next trip: Future');
  });

  it('picks the dominant currency by total when currencies are mixed', () => {
    const expenses = [
      makeExpense({ amount: 5, currency: 'USD' }),
      makeExpense({ amount: 500, currency: 'JPY' }),
    ];
    const snap = currentSnapshot([], expenses, NOW);
    expect(snap).toContain('Expenses logged: 2');
    expect(snap).toContain('500.00 JPY');
  });
});

describe('composeFirstTurn', () => {
  it('returns the prompt unchanged when there is no snapshot', () => {
    expect(composeFirstTurn('What is the weather?', '')).toBe('What is the weather?');
  });

  it('prefixes the snapshot as grounding context', () => {
    const out = composeFirstTurn('Where to eat?', 'SNAPSHOT-BODY');
    expect(out).toContain('SNAPSHOT-BODY');
    expect(out).toContain('Where to eat?');
    expect(out.indexOf('SNAPSHOT-BODY')).toBeLessThan(out.indexOf('Where to eat?'));
  });
});
