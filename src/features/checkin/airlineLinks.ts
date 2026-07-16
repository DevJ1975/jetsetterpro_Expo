// Airline check-in deep links — port of the fallback dictionary in the iOS
// `Core/Services/CheckInService.swift` (the Amadeus lookup is server-side and
// arrives later; the hardcoded map is the offline/demo path).

export interface AirlineLink {
  name: string;
  url: string;
  /** Hours before departure that online check-in opens (default 24). */
  leadHours: number;
}

const entry = (name: string, url: string, leadHours = 24): AirlineLink => ({
  name,
  url,
  leadHours,
});

export const AIRLINE_LINKS: Record<string, AirlineLink> = {
  // US carriers — nearly all open at T-24h.
  UA: entry('United Airlines', 'https://www.united.com/en/us/checkin'),
  DL: entry('Delta Air Lines', 'https://www.delta.com/us/en/check-in/overview'),
  AA: entry('American Airlines', 'https://www.aa.com/checkin/viewCheckinPage'),
  WN: entry('Southwest Airlines', 'https://www.southwest.com/air/check-in/'),
  B6: entry('JetBlue', 'https://checkin.jetblue.com/'),
  AS: entry('Alaska Airlines', 'https://www.alaskaair.com/checkin'),
  NK: entry('Spirit Airlines', 'https://www.spirit.com/CheckIn'),
  F9: entry('Frontier Airlines', 'https://www.flyfrontier.com/travel/travel-info/check-in/'),
  HA: entry('Hawaiian Airlines', 'https://www.hawaiianairlines.com/my-trips/check-in'),
  G4: entry('Allegiant Air', 'https://www.allegiantair.com/online-check-in'),
  // International carriers — several open earlier than 24h.
  BA: entry(
    'British Airways',
    'https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb',
  ),
  AF: entry('Air France', 'https://checkin.airfrance.com/', 30),
  LH: entry('Lufthansa', 'https://www.lufthansa.com/us/en/online-check-in', 23),
  EK: entry('Emirates', 'https://www.emirates.com/english/manage/online-check-in/', 48),
  QR: entry('Qatar Airways', 'https://www.qatarairways.com/en/check-in.html', 48),
  AC: entry('Air Canada', 'https://www.aircanada.com/us/en/aco/home/fly/check-in.html'),
  WS: entry('WestJet', 'https://www.westjet.com/en-ca/check-in'),
  LA: entry(
    'LATAM Airlines',
    'https://www.latamairlines.com/us/en/experience/prepare-your-trip/check-in',
    48,
  ),
  AV: entry(
    'Avianca',
    'https://www.avianca.com/us/en/prepare-your-trip/at-the-airport/check-in/',
  ),
  KL: entry(
    'KLM Royal Dutch Airlines',
    'https://www.klm.com/us/en/travel-information/check-in/online-check-in',
    30,
  ),
  // Carriers in the iOS brand-color map that the URL dictionary lacked.
  JL: entry('Japan Airlines', 'https://www.jal.co.jp/jp/en/dom/checkin/'),
  NH: entry('All Nippon Airways', 'https://www.ana.co.jp/en/us/travel-information/online-checkin/'),
};

/** Leading letters of a flight ident, upper-cased: 'aa169' → 'AA'. */
export function carrierCode(ident: string): string {
  const m = ident.trim().toUpperCase().match(/^([A-Z]{1,3})/);
  return m ? m[1] : '';
}

/** Airline display name for a flight ident ('AA169' → 'American Airlines'). */
export function airlineDisplayName(ident: string): string {
  const code = carrierCode(ident);
  return AIRLINE_LINKS[code]?.name ?? (code || 'your airline');
}

/** The carrier's online check-in URL — falls back to a web search deep link so
 *  the UI never dead-ends (mirrors iOS `searchFallbackResult`). */
export function airlineCheckInUrl(ident: string): string {
  const code = carrierCode(ident);
  const known = AIRLINE_LINKS[code];
  if (known) return known.url;
  const q = encodeURIComponent(`${code || ident} airline online check in`);
  return `https://www.google.com/search?q=${q}`;
}

/** Hours before departure that this carrier's check-in window opens. */
export function checkInLeadHours(ident: string): number {
  return AIRLINE_LINKS[carrierCode(ident)]?.leadHours ?? 24;
}
