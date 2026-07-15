import { COUNTRIES } from '@/src/core/data/countries';

// Trip destination → ISO currency code, ported from the iOS
// CurrencyExpenseRouterView two-pass matcher: multi-word keys match as
// substrings (unambiguous), single-word keys match whole tokens only (so
// "uk" never matches "Fukuoka"). Falls back to the bundled COUNTRIES data,
// then null when nothing conclusive is found.

const MAP: Record<string, string> = {
  japan: 'JPY', tokyo: 'JPY', osaka: 'JPY', kyoto: 'JPY',
  'united kingdom': 'GBP', uk: 'GBP', london: 'GBP',
  france: 'EUR', paris: 'EUR',
  germany: 'EUR', berlin: 'EUR', munich: 'EUR',
  italy: 'EUR', rome: 'EUR', milan: 'EUR',
  spain: 'EUR', madrid: 'EUR', barcelona: 'EUR',
  netherlands: 'EUR', amsterdam: 'EUR',
  portugal: 'EUR', lisbon: 'EUR', porto: 'EUR',
  ireland: 'EUR', dublin: 'EUR',
  greece: 'EUR', athens: 'EUR',
  switzerland: 'CHF', zurich: 'CHF',
  canada: 'CAD', toronto: 'CAD', vancouver: 'CAD',
  mexico: 'MXN', cdmx: 'MXN', cancun: 'MXN',
  brazil: 'BRL', rio: 'BRL', 'sao paulo': 'BRL',
  australia: 'AUD', sydney: 'AUD', melbourne: 'AUD',
  'new zealand': 'NZD', auckland: 'NZD',
  china: 'CNY', shanghai: 'CNY', beijing: 'CNY',
  'hong kong': 'HKD',
  singapore: 'SGD',
  'south korea': 'KRW', seoul: 'KRW',
  thailand: 'THB', bangkok: 'THB',
  vietnam: 'VND', hanoi: 'VND',
  india: 'INR', mumbai: 'INR', delhi: 'INR',
  uae: 'AED', dubai: 'AED', 'abu dhabi': 'AED',
  'south africa': 'ZAR', 'cape town': 'ZAR',
  argentina: 'ARS', 'buenos aires': 'ARS',
  turkey: 'TRY', istanbul: 'TRY',
  egypt: 'EGP', cairo: 'EGP',
  'united states': 'USD', usa: 'USD',
};

const tokenize = (s: string): string[] => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** Currency code for a trip destination string, or null when unknown. */
export function destinationCurrencyFor(destination: string): string | null {
  const lower = destination.toLowerCase();
  const tokens = new Set(tokenize(destination));
  // Pass 1: unambiguous multi-word keys via substring.
  for (const [key, currency] of Object.entries(MAP)) {
    if (key.includes(' ') && lower.includes(key)) return currency;
  }
  // Pass 2: single-word keys via exact token match (no substring bleed).
  for (const [key, currency] of Object.entries(MAP)) {
    if (!key.includes(' ') && tokens.has(key)) return currency;
  }
  // Pass 3: bundled country data — every word of the country name must appear.
  for (const c of COUNTRIES) {
    const nameTokens = tokenize(c.name);
    if (nameTokens.length > 0 && nameTokens.every((t) => tokens.has(t))) return c.currency;
  }
  return null;
}
