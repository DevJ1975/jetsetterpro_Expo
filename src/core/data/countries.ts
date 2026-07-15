// Compact travel-essentials + US-passport visa dataset (the RN port of the iOS
// TravelEssentialsData / VisaRequirements bundled data). Not exhaustive — always
// verify entry rules with the destination's official source before travel.

export type VisaStatus = 'visa-free' | 'eTA' | 'eVisa' | 'on-arrival' | 'required' | 'home';

/** Per-service dial numbers (iOS EmergencyNumbers). All optional-field additive. */
export interface EmergencyNumbers {
  police: string;
  ambulance: string;
  fire: string;
  /** e.g. 112 in the EU; omitted when each service has its own number. */
  general?: string;
  touristHotline?: string;
}

/** Entry-requirement detail for US passport holders (iOS VisaRequirements). */
export interface VisaDetail {
  /** Maximum stay in days for visa-free / eTA / on-arrival kinds. */
  maxStay?: number;
  /** Entry/visa fee, human-formatted (e.g. "$25 USD"). Omitted = free / n.a. */
  fee?: string;
  /** Proof of onward travel required at entry. */
  onwardTicket?: boolean;
  /** Minimum passport validity after arrival; 0 = valid through stay. */
  passportValidityMonths?: number;
  blankPages?: number;
}

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
  // ── Optional additive fields (iOS TravelEssentialsData parity) ──────────────
  /** Broad region caption for the country hero (e.g. "Western Europe"). */
  region?: string;
  /** Tap water is safe to drink. Omitted = unknown (card hidden). */
  waterSafe?: boolean;
  /** Common tourist scams to watch out for. */
  scams?: string[];
  /** Plug-type letters, e.g. ['C', 'E']. */
  plugTypes?: string[];
  /** Structured per-service emergency numbers for tap-to-dial rows. */
  emergencyNumbers?: EmergencyNumbers;
  /** US-passport entry requirement detail. */
  visaDetail?: VisaDetail;
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', region: 'North America',
    emergency: '911 (all)', tipping: '15–20% at restaurants; $1–2/bag', plug: 'Type A/B · 120V / 60Hz',
    phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' },
    visa: { status: 'home', note: 'Home country' },
    emergencyNumbers: { police: '911', ambulance: '911', fire: '911', general: '911' },
    plugTypes: ['A', 'B'], waterSafe: true,
    scams: ['Times Square costumed characters demanding tips', 'Aggressive “CD artists” in tourist areas'],
  },
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', region: 'Northern Europe',
    emergency: '999 or 112', tipping: '10–15% if not already included', plug: 'Type G · 230V / 50Hz',
    phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' },
    visa: { status: 'eTA', stay: '6 months', note: 'UK ETA required — apply via the UK ETA app or gov.uk' },
    emergencyNumbers: { police: '999', ambulance: '999', fire: '999', general: '112' },
    plugTypes: ['G'], waterSafe: true,
    scams: ['Unlicensed minicabs at airports — use black cabs or pre-booked', 'Fake “card declined” tap at restaurants — watch your card'],
    visaDetail: { maxStay: 180, fee: '£10', onwardTicket: false, passportValidityMonths: 0, blankPages: 1 },
  },
  {
    code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', region: 'Western Europe',
    emergency: '112', tipping: 'Service included; round up', plug: 'Type C/E · 230V / 50Hz',
    phrases: { hello: 'Bonjour', thanks: 'Merci', help: 'Au secours' },
    visa: { status: 'visa-free', stay: '90 days', note: 'Schengen · ETIAS pending' },
    emergencyNumbers: { police: '17', ambulance: '15', fire: '18', general: '112' },
    plugTypes: ['C', 'E'], waterSafe: true,
    scams: ['Petition scams near tourist sites (Eiffel Tower, Sacré-Cœur)', 'Gold ring “find” scam along the Seine', 'Friendship bracelet hustlers at Montmartre'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 3, blankPages: 2 },
  },
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', region: 'Central Europe',
    emergency: '112', tipping: 'Round up ~5–10%', plug: 'Type C/F · 230V / 50Hz',
    phrases: { hello: 'Hallo', thanks: 'Danke', help: 'Hilfe' },
    visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' },
    emergencyNumbers: { police: '110', ambulance: '112', fire: '112', general: '112' },
    plugTypes: ['C', 'F'], waterSafe: true,
    scams: ['Gambling “shell game” scams around Brandenburg Gate', 'Train ticket touts — buy from machines or counters only'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 3, blankPages: 2 },
  },
  {
    code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR', region: 'Southern Europe',
    emergency: '112', tipping: 'Coperto often added; round up', plug: 'Type C/F/L · 230V / 50Hz',
    phrases: { hello: 'Ciao', thanks: 'Grazie', help: 'Aiuto' },
    visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' },
    emergencyNumbers: { police: '113', ambulance: '118', fire: '115', general: '112' },
    plugTypes: ['C', 'F', 'L'], waterSafe: true,
    scams: ['Fake police asking to check your wallet', 'Aggressive flower/trinket sellers in Rome', 'Inflated taxi fares — insist on the meter'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 3, blankPages: 2 },
  },
  {
    code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR', region: 'Southern Europe',
    emergency: '112', tipping: 'Small change is fine', plug: 'Type C/F · 230V / 50Hz',
    phrases: { hello: 'Hola', thanks: 'Gracias', help: 'Ayuda' },
    visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' },
    emergencyNumbers: { police: '091', ambulance: '061', fire: '080', general: '112' },
    plugTypes: ['C', 'F'], waterSafe: true,
    scams: ['Pickpockets on Las Ramblas and the Metro in Barcelona', 'Distraction scams (“look at this bird/map”)', 'Card-skimming ATMs — use bank-branded machines'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 3, blankPages: 2 },
  },
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', region: 'Western Europe',
    emergency: '112', tipping: 'Round up ~5–10%', plug: 'Type C/F · 230V / 50Hz',
    phrases: { hello: 'Hallo', thanks: 'Dank je', help: 'Help' },
    visa: { status: 'visa-free', stay: '90 days', note: 'Schengen' },
    emergencyNumbers: { police: '112', ambulance: '112', fire: '112', general: '112' },
    plugTypes: ['C', 'F'], waterSafe: true,
    scams: ['Pickpockets in Centraal Station and the Red Light District'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 3, blankPages: 2 },
  },
  {
    code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', region: 'East Asia',
    emergency: '110 police · 119 amb/fire', tipping: 'Not customary — can offend', plug: 'Type A/B · 100V / 50–60Hz',
    phrases: { hello: 'Konnichiwa', thanks: 'Arigatō', help: 'Tasukete' },
    visa: { status: 'visa-free', stay: '90 days' },
    emergencyNumbers: { police: '110', ambulance: '119', fire: '119', touristHotline: '050-3816-2787' },
    plugTypes: ['A', 'B'], waterSafe: true,
    scams: ['Overpriced “snack bar” clip joints in Roppongi/Kabukichō', 'Touts offering “introductions” to restaurants — walk past'],
    visaDetail: { maxStay: 90, onwardTicket: false, passportValidityMonths: 0, blankPages: 1 },
  },
  {
    code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY', region: 'East Asia',
    emergency: '110 police · 120 amb', tipping: 'Not customary', plug: 'Type A/C/I · 220V / 50Hz',
    phrases: { hello: 'Nǐ hǎo', thanks: 'Xièxie', help: 'Jiùmìng' },
    visa: { status: 'required', note: 'Tourist visa; transit exemptions in some cities' },
    emergencyNumbers: { police: '110', ambulance: '120', fire: '119', touristHotline: '12301' },
    plugTypes: ['A', 'C', 'I'], waterSafe: false,
    scams: ['“Tea house” invitations from friendly strangers in Beijing/Shanghai', 'Art student gallery scams'],
    visaDetail: { fee: '$185 USD', onwardTicket: false, passportValidityMonths: 6, blankPages: 2 },
  },
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', region: 'Oceania',
    emergency: '000', tipping: 'Not expected; ~10% for great service', plug: 'Type I · 230V / 50Hz',
    phrases: { hello: 'Hello', thanks: 'Thanks', help: 'Help' },
    visa: { status: 'eTA', stay: '90 days', note: 'ETA (Subclass 601) required before travel' },
    emergencyNumbers: { police: '000', ambulance: '000', fire: '000', general: '112' },
    plugTypes: ['I'], waterSafe: true,
    visaDetail: { maxStay: 90, fee: 'AUD $20', onwardTicket: false, passportValidityMonths: 0, blankPages: 1 },
  },
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', region: 'North America',
    emergency: '911', tipping: '15–20% at restaurants', plug: 'Type A/B · 120V / 60Hz',
    phrases: { hello: 'Hello', thanks: 'Thank you', help: 'Help' },
    visa: { status: 'eTA', stay: '6 months', note: 'eTA for air travel; not needed for land/sea entry' },
    emergencyNumbers: { police: '911', ambulance: '911', fire: '911', general: '911' },
    plugTypes: ['A', 'B'], waterSafe: true,
    visaDetail: { maxStay: 180, fee: 'CAD $7', onwardTicket: false, passportValidityMonths: 0, blankPages: 1 },
  },
  {
    code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', region: 'North America',
    emergency: '911', tipping: '10–15%', plug: 'Type A/B · 127V / 60Hz',
    phrases: { hello: 'Hola', thanks: 'Gracias', help: 'Ayuda' },
    visa: { status: 'visa-free', stay: '180 days', note: 'FMM tourist card issued at entry' },
    emergencyNumbers: { police: '911', ambulance: '911', fire: '911', general: '911', touristHotline: '078' },
    plugTypes: ['A', 'B'], waterSafe: false,
    scams: ['Inflated “turista” taxi rates — use Uber or pre-paid airport taxis', 'Distraction scams in the Zócalo (CDMX)'],
    visaDetail: { maxStay: 180, onwardTicket: false, passportValidityMonths: 6, blankPages: 1 },
  },
  {
    code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', region: 'South America',
    emergency: '190 police · 192 amb', tipping: '10% usually included', plug: 'Type C/N · 127/220V / 60Hz',
    phrases: { hello: 'Olá', thanks: 'Obrigado', help: 'Socorro' },
    visa: { status: 'eVisa', stay: '90 days', note: 'eVisa reinstated 2025 — apply via VFS Global' },
    emergencyNumbers: { police: '190', ambulance: '192', fire: '193' },
    plugTypes: ['C', 'N'], waterSafe: false,
    scams: ['Rio: avoid showing valuables on the beach; use ride-shares, not random taxis'],
    visaDetail: { maxStay: 90, fee: '$80.90 USD', onwardTicket: false, passportValidityMonths: 6, blankPages: 2 },
  },
  {
    code: 'TH', name: 'Thailand', flag: '🇹🇭', currency: 'THB', region: 'Southeast Asia',
    emergency: '191 police · 1669 amb', tipping: 'Not expected; round up', plug: 'Type A/B/C · 220V / 50Hz',
    phrases: { hello: 'Sawasdee', thanks: 'Khop khun', help: 'Chuay duay' },
    visa: { status: 'visa-free', stay: '60 days', note: 'Visa-free stay extended to 60 days as of 2024' },
    emergencyNumbers: { police: '191', ambulance: '1669', fire: '199', touristHotline: '1155' },
    plugTypes: ['A', 'B', 'C'], waterSafe: false,
    scams: ['“Grand Palace closed” tuk-tuk scam — go straight to the entrance', 'Gem and tailor scams', 'Jet ski “damage” shakedowns in Phuket'],
    visaDetail: { maxStay: 60, onwardTicket: true, passportValidityMonths: 6, blankPages: 1 },
  },
  {
    code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', region: 'Middle East',
    emergency: '999 police · 998 amb', tipping: '10–15%', plug: 'Type G · 230V / 50Hz',
    phrases: { hello: 'Marhaba', thanks: 'Shukran', help: "Musa'ada" },
    visa: { status: 'on-arrival', stay: '30 days', note: 'Free visa stamped on arrival' },
    emergencyNumbers: { police: '999', ambulance: '998', fire: '997', general: '999' },
    plugTypes: ['G'], waterSafe: true,
    scams: ['Unlicensed gold/perfume shops with inflated prices'],
    visaDetail: { maxStay: 30, onwardTicket: false, passportValidityMonths: 6, blankPages: 2 },
  },
  {
    code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', region: 'South Asia',
    emergency: '112', tipping: '5–10%', plug: 'Type C/D/M · 230V / 50Hz',
    phrases: { hello: 'Namaste', thanks: 'Dhanyavaad', help: 'Madad' },
    visa: { status: 'eVisa', note: 'e-Tourist visa required before travel' },
    emergencyNumbers: { police: '100', ambulance: '102', fire: '101', general: '112', touristHotline: '1363' },
    plugTypes: ['C', 'D', 'M'], waterSafe: false,
    scams: ['Inflated tuk-tuk fares — agree price first or use Ola/Uber', '“Closed” hotel/attraction redirects', 'Train ticket office scams in Delhi — only use official IRCTC counters'],
    visaDetail: { maxStay: 30, fee: '$25 USD', onwardTicket: false, passportValidityMonths: 6, blankPages: 2 },
  },
];

export const VISA_META: Record<VisaStatus, { label: string; tone: 'good' | 'accent' | 'warn' | 'bad' | 'neutral' }> = {
  home: { label: 'Home', tone: 'neutral' },
  'visa-free': { label: 'Visa-free', tone: 'good' },
  eTA: { label: 'eTA', tone: 'accent' },
  eVisa: { label: 'eVisa', tone: 'accent' },
  'on-arrival': { label: 'On arrival', tone: 'warn' },
  required: { label: 'Visa required', tone: 'bad' },
};

/** Common alternate names → ISO code (ported from the iOS CountryPickerSheet
 *  alias list) so "Holland", "UK", "UAE" etc. resolve to catalog entries.
 *  Aliases pointing at countries not in COUNTRIES simply resolve to nothing. */
export const COUNTRY_ALIASES: Record<string, string> = {
  turkey: 'TR', holland: 'NL', uk: 'GB', britain: 'GB', 'great britain': 'GB',
  england: 'GB', uae: 'AE', emirates: 'AE', korea: 'KR', 'south korea': 'KR',
  usa: 'US', america: 'US', 'united states of america': 'US',
};

/** Flag emoji from an ISO-3166 alpha-2 code via regional-indicator codepoints.
 *  Pure — safe to call in render. Falls back to a white flag on bad input. */
export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(
    ...Array.from(cc, (ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

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
  // Alias hit (whole string or a comma-separated token, e.g. "Amsterdam, Holland").
  const tokens = [d.trim(), ...d.split(',').map((t) => t.trim())];
  for (const t of tokens) {
    const code = COUNTRY_ALIASES[t];
    if (code) {
      const hit = COUNTRIES.find((c) => c.code === code);
      if (hit) return hit;
    }
  }
  return COUNTRIES.find((c) => d.includes(c.name.toLowerCase()));
}
