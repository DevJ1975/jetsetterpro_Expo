// US states & territories for the Digital Driver's License hub card — RN port
// of iOS `DigitalIDStates.swift`, expanded to every state so the picker is a
// full searchable list. `live` marks jurisdictions whose IDs are live in Apple
// Wallet (per https://support.apple.com/118313); those get the LIVE badge and
// an official DMV mDL info link.

export interface MdlState {
  /** 2-letter postal code, e.g. "AZ". */
  code: string;
  name: string;
  /** Issuing agency shown under the name (live states). */
  issuer?: string;
  /** Official DMV/mDL landing page (live states). */
  infoUrl?: string;
  /** Live in Apple Wallet vs. not yet announced/launched. */
  live: boolean;
}

/** Apple's authoritative "IDs in Wallet" list — fallback info link. */
export const APPLE_WALLET_ID_LIST_URL = 'https://support.apple.com/118313';
export const APPLE_WALLET_ID_GUIDE_URL = 'https://support.apple.com/id-cards-in-wallet';

const LIVE: Record<string, { issuer: string; infoUrl: string }> = {
  AZ: {
    issuer: 'Arizona Department of Transportation',
    infoUrl: 'https://azdot.gov/mvd/services/driver-services/mobile-id',
  },
  CA: { issuer: 'California DMV', infoUrl: 'https://www.dmv.ca.gov/portal/ca-mobile-driver-license/' },
  CO: { issuer: 'Colorado DMV', infoUrl: 'https://dmv.colorado.gov/myColorado-mobile-id' },
  GA: { issuer: 'Georgia Department of Driver Services', infoUrl: 'https://dds.georgia.gov/digital-license-id' },
  HI: { issuer: 'Hawaii Department of Transportation', infoUrl: 'https://hidot.hawaii.gov/' },
  IA: { issuer: 'Iowa DOT', infoUrl: 'https://iowadot.gov/mvd/mobile-id' },
  KY: { issuer: 'Kentucky Transportation Cabinet', infoUrl: 'https://drive.ky.gov/' },
  MD: { issuer: 'Maryland MVA', infoUrl: 'https://mva.maryland.gov/Pages/MobileID.aspx' },
  NM: { issuer: 'New Mexico MVD', infoUrl: 'https://www.mvd.newmexico.gov/' },
  OH: { issuer: 'Ohio BMV', infoUrl: 'https://bmv.ohio.gov/' },
  PR: { issuer: 'Puerto Rico DTOP', infoUrl: 'https://dtop.pr.gov/' },
  UT: { issuer: 'Utah Driver License Division', infoUrl: 'https://dld.utah.gov/mobile-driver-license/' },
  WV: { issuer: 'West Virginia DMV', infoUrl: 'https://transportation.wv.gov/DMV/' },
};

const ALL_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'],
  ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'],
  ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export const MDL_STATES: MdlState[] = ALL_STATES.map(([code, name]) => {
  const live = LIVE[code];
  return live
    ? { code, name, issuer: live.issuer, infoUrl: live.infoUrl, live: true }
    : { code, name, live: false };
});

export function findMdlState(code?: string): MdlState | undefined {
  if (!code) return undefined;
  return MDL_STATES.find((s) => s.code === code.toUpperCase());
}

/** Default selection mirrors iOS (Arizona — the first state to go live). */
export const DEFAULT_MDL_STATE = 'AZ';
