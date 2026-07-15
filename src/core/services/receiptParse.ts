// Pure receipt-text heuristics (unit-tested; the impure camera/OCR edge lives
// in receiptScan.ts). Mirrors the iOS VisionOCR parsing approach: prefer the
// amount on a "total" line, currency from symbol/code, first plausible
// merchant line, and any recognizable date.

export interface ParsedReceipt {
  amount?: number;
  currency?: string;
  merchant?: string;
  date?: string; // YYYY-MM-DD
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₩': 'KRW',
  '₹': 'INR',
};
const CURRENCY_CODES = /(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|KRW|MXN|INR|SGD|HKD|THB|AED)/i;

const MONEY = /(?:[$€£¥₩₹]\s*)?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})/;
const TOTAL_LINE = /total|amount\s*due|balance\s*due|grand\s*total|to\s*pay/i;
const EXCLUDE_LINE = /subtotal|sub-total|tax|tip|change|cash|visa|mastercard|amex|auth/i;

function parseMoneyToken(token: string): number | undefined {
  // Handle 1,234.56 and 1.234,56 and 1234.56
  const cleaned = token.replace(/\s/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    // comma-decimal locale
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function findAmount(lines: string[]): number | undefined {
  // 1) prefer a money token on a "total" line (skipping subtotal/tax lines)
  for (const line of lines) {
    if (TOTAL_LINE.test(line) && !EXCLUDE_LINE.test(line)) {
      const m = line.match(MONEY);
      if (m) {
        const v = parseMoneyToken(m[1]);
        if (v !== undefined) return v;
      }
    }
  }
  // 2) fall back to the largest money token on the receipt
  let max: number | undefined;
  for (const line of lines) {
    const m = line.match(MONEY);
    if (m) {
      const v = parseMoneyToken(m[1]);
      if (v !== undefined && (max === undefined || v > max)) max = v;
    }
  }
  return max;
}

function findCurrency(text: string): string | undefined {
  const code = text.match(CURRENCY_CODES);
  if (code) return code[1].toUpperCase();
  for (const [symbol, iso] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) return iso;
  }
  return undefined;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function findDate(text: string): string | undefined {
  // ISO first
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  // US mm/dd/yyyy (or dd.mm.yyyy — disambiguate by >12)
  m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) return iso(y, b, a); // dd.mm.yyyy
    return iso(y, a, b); // mm/dd/yyyy
  }
  // 'Jul 14 2026' / '14 Jul 2026'
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    return iso(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
  }
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    return iso(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]));
  }
  return undefined;
}

function iso(y: number, mo: number, d: number): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function findMerchant(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 6)) {
    const line = raw.trim();
    if (line.length < 3 || line.length > 40) continue;
    if (MONEY.test(line)) continue;
    if (/\d{3,}/.test(line)) continue; // addresses / phone numbers
    if (/receipt|invoice|order|tel|www\.|http|welcome|thank/i.test(line)) continue;
    const letters = line.replace(/[^A-Za-z]/g, '').length;
    if (letters / line.length < 0.6) continue;
    return line;
  }
  return undefined;
}

export function parseReceiptText(raw: string): ParsedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const text = lines.join('\n');
  return {
    amount: findAmount(lines),
    currency: findCurrency(text),
    merchant: findMerchant(lines),
    date: findDate(text),
  };
}
