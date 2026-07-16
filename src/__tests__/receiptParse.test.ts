import { parseReceiptText } from '@/src/core/services/receiptParse';

describe('receipt OCR parsing', () => {
  it('prefers the amount on a TOTAL line over larger noise', () => {
    const r = parseReceiptText(
      ['BLUE BOTTLE COFFEE', '300 Webster St', 'Latte 6.50', 'Croissant 5.25', 'Subtotal 11.75', 'Tax 1.05', 'TOTAL $12.80', '07/12/2026'].join('\n'),
    );
    expect(r.amount).toBe(12.8);
    expect(r.currency).toBe('USD');
    expect(r.merchant).toBe('BLUE BOTTLE COFFEE');
    expect(r.date).toBe('2026-07-12');
  });

  it('falls back to the largest money token when no total line exists', () => {
    const r = parseReceiptText('Espresso 4.00\nSandwich 12.50\nWater 2.00');
    expect(r.amount).toBe(12.5);
  });

  it('handles comma-decimal locales (1.234,56)', () => {
    const r = parseReceiptText('RESTAURANT MILANO\nTotale € 1.234,56\n14.07.2026');
    expect(r.amount).toBe(1234.56);
    expect(r.currency).toBe('EUR');
    expect(r.date).toBe('2026-07-14');
  });

  it('parses named-month dates and currency codes', () => {
    const r = parseReceiptText('CAFE TOKYO\nTotal 1500 JPY\nJul 3, 2026');
    expect(r.currency).toBe('JPY');
    expect(r.date).toBe('2026-07-03');
  });

  it('returns empty fields on garbage without throwing', () => {
    expect(parseReceiptText('')).toEqual({
      amount: undefined,
      currency: undefined,
      merchant: undefined,
      date: undefined,
    });
  });
});
