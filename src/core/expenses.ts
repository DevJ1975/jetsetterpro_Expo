import type { Expense } from '@/src/types/models';
import { formatMoney } from './format';

// Expenses carry a per-row currency that can differ from the home currency, so
// amounts must NEVER be summed across currencies. These helpers total per
// currency (the same shape the IRIS snapshot and the PDF export already use).

export interface CurrencyTotal {
  currency: string;
  total: number;
}

/** Totals grouped by currency, sorted by total descending. */
export function sumByCurrency(expenses: Expense[]): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  return [...totals.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

/** A per-currency total string, e.g. "$1,234.00 · ¥5,000". Falls back to a zero
 *  in `fallbackCurrency` when there are no expenses. */
export function formatByCurrency(expenses: Expense[], fallbackCurrency = 'USD'): string {
  const sums = sumByCurrency(expenses);
  if (sums.length === 0) return formatMoney(0, fallbackCurrency);
  return sums.map((s) => formatMoney(s.total, s.currency)).join(' · ');
}
