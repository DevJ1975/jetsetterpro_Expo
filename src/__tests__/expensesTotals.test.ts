import { formatByCurrency, sumByCurrency } from '@/src/core/expenses';
import { makeExpense } from './_fixtures';

describe('sumByCurrency', () => {
  it('totals per currency, sorted by total descending', () => {
    const out = sumByCurrency([
      makeExpense({ amount: 10, currency: 'USD' }),
      makeExpense({ amount: 5000, currency: 'JPY' }),
      makeExpense({ amount: 20, currency: 'USD' }),
    ]);
    expect(out).toEqual([
      { currency: 'JPY', total: 5000 },
      { currency: 'USD', total: 30 },
    ]);
  });

  it('returns [] for no expenses', () => {
    expect(sumByCurrency([])).toEqual([]);
  });
});

describe('formatByCurrency', () => {
  it('never sums across currencies — renders each currency separately', () => {
    const out = formatByCurrency([
      makeExpense({ amount: 100, currency: 'USD' }),
      makeExpense({ amount: 5000, currency: 'JPY' }),
    ]);
    // Order is by total desc → JPY (5000) then USD (100). Each labelled in its own currency.
    expect(out).toContain('5,000');
    expect(out).toContain('100');
    expect(out).toContain(' · ');
    expect(out).not.toContain('5,100'); // the old cross-currency bug
  });

  it('falls back to a zero in the fallback currency when empty', () => {
    expect(formatByCurrency([], 'USD')).toContain('0');
  });

  it('renders a single currency with no separator', () => {
    const out = formatByCurrency([
      makeExpense({ amount: 10, currency: 'EUR' }),
      makeExpense({ amount: 20, currency: 'EUR' }),
    ]);
    expect(out).not.toContain(' · ');
    expect(out).toContain('30');
  });
});
