// Compact travel-essentials + US-passport visa dataset (the RN port of the iOS
// TravelEssentialsData / VisaRequirements bundled data). Not exhaustive — always
// verify entry rules with the destination's official source before travel.

export type VisaStatus = 'visa-free' | 'eVisa' | 'on-arrival' | 'required' | 'home';

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  currency: string;
  emergency: string;
  tipping: string;
  plug: string;
  phrases: { hello: string; thanks: string; help: string };
  visa: { status: VisaStatus; stay?: string; note?: string };
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', emergency: '911 (all)', tipping: '15–20% at restaurants; $1–2/bag', plug: 'Type A/B · 120V', phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' }, visa: { status: 'home', note: 'Home country' } },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', emergency: '999 or 112', tipping: '10–15% if not already included', plug: 'Type G · 230V', phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' }, visa: { status: 'visa-free', stay: '6 months' } },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', emergency: '112', tipping: 'Service included; round up', plug: 'Type C/E · 230V', phrases: { hello: 'Bonjour', thanks: 'Merci', help: 'Au secours' }, visa: { status: 'visa-free', stay: '90 days', note: 'Schengen · ETIAS pending' } },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', emergency: '112', tipping: 'Round up ~5–10%', plug: 'Type C/F · 230V', phrases: { hello: 'Hallo', thanks: 'Danke', help: 'Hilfe' }, visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' } },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR', emergency: '112', tipping: 'Coperto often added; round up', plug: 'Type C/F/L · 230V', phrases: { hello: 'Ciao', thanks: 'Grazie', help: 'Aiuto' }, visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' } },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR', emergency: '112', tipping: 'Small change is fine', plug: 'Type C/F · 230V', phrases: { hello: 'Hola', thanks: 'Gracias', help: 'Ayuda' }, visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' } },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', emergency: '112', tipping: 'Round up ~5–10%', plug: 'Type C/F · 230V', phrases: { hello: 'Hallo', thanks: 'Dank je', help: 'Help' }, visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' } },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', emergency: '110 police · 119 amb/fire', tipping: 'Not customary — can offend', plug: 'Type A/B · 100V', phrases: { hello: 'Konnichiwa', thanks: 'Arigatō', help: 'Tasukete' }, visa: { status: 'visa-free', stay: '90 days' } },
  { code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY', emergency: '110 police · 120 amb', tipping: 'Not customary', plug: 'Type A/C/I · 220V', phrases: { hello: 'Nǐ hǎo', thanks: 'Xièxie', help: 'Jiùmìng' }, visa: { status: 'required', note: 'Tourist visa; transit exemptions in some cities' } },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', emergency: '000', tipping: 'Not expected; ~10% for great service', plug: 'Type I · 230V', phrases: { hello: 'Hello', thanks: 'Thanks', help: 'Help' }, visa: { status: 'eVisa', stay: '90 days', note: 'ETA required before travel' } },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', emergency: '911', tipping: '15–20% at restaurants', plug: 'Type A/B · 120V', phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' }, visa: { status: 'eVisa', stay: '6 months', note: 'eTA for air travel' } },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', emergency: '911', tipping: '10–15%', plug: 'Type A/B · 127V', phrases: { hello: 'Hola', thanks: 'Gracias', help: 'Ayuda' }, visa: { status: 'visa-free', stay: '180 days' } },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', emergency: '190 police · 192 amb', tipping: '10% usually included', plug: 'Type C/N · 127/220V', phrases: { hello: 'Olá', thanks: 'Obrigado', help: 'Socorro' }, visa: { status: 'visa-free', stay: '90 days' } },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', currency: 'THB', emergency: '191 police · 1669 amb', tipping: 'Not expected; round up', plug: 'Type A/B/C · 220V', phrases: { hello: 'Sawasdee', thanks: 'Khop khun', help: 'Chuay duay' }, visa: { status: 'visa-free', stay: '30 days', note: 'Extendable on arrival' } },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', emergency: '999 police · 998 amb', tipping: '10–15%', plug: 'Type G · 230V', phrases: { hello: 'Marhaba', thanks: 'Shukran', help: "Musa'ada" }, visa: { status: 'on-arrival', stay: '30 days' } },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', emergency: '112', tipping: '5–10%', plug: 'Type C/D/M · 230V', phrases: { hello: 'Namaste', thanks: 'Dhanyavaad', help: 'Madad' }, visa: { status: 'eVisa', note: 'e-Tourist visa required before travel' } },
];

export const VISA_META: Record<VisaStatus, { label: string; tone: 'good' | 'accent' | 'warn' | 'bad' | 'neutral' }> = {
  home: { label: 'Home', tone: 'neutral' },
  'visa-free': { label: 'Visa-free', tone: 'good' },
  eVisa: { label: 'eVisa', tone: 'accent' },
  'on-arrival': { label: 'On arrival', tone: 'warn' },
  required: { label: 'Visa required', tone: 'bad' },
};

/** Best-effort match of a free-text destination ("Tokyo, Japan") to a country. */
export function matchCountry(destination?: string): CountryInfo | undefined {
  if (!destination) return undefined;
  const d = destination.toLowerCase();
  const cities: Record<string, string> = {
    tokyo: 'JP', osaka: 'JP', london: 'GB', paris: 'FR', berlin: 'DE', munich: 'DE',
    rome: 'IT', milan: 'IT', madrid: 'ES', barcelona: 'ES', amsterdam: 'NL',
    beijing: 'CN', shanghai: 'CN', sydney: 'AU', melbourne: 'AU', toronto: 'CA',
    'mexico city': 'MX', cancun: 'MX', bangkok: 'TH', dubai: 'AE', mumbai: 'IN', delhi: 'IN',
    boston: 'US', 'new york': 'US', 'san francisco': 'US', chicago: 'US', 'los angeles': 'US',
  };
  for (const [city, code] of Object.entries(cities)) {
    if (d.includes(city)) return COUNTRIES.find((c) => c.code === code);
  }
  return COUNTRIES.find((c) => d.includes(c.name.toLowerCase()));
}
