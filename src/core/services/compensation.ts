// Flight-delay compensation estimator (EU261 / US DOT). Informational only —
// not legal advice; airlines can contest under "extraordinary circumstances".

export type Region = 'EU' | 'US' | 'other';

export interface CompensationInput {
  region: Region;
  distanceKm: number;
  delayHours: number;
  cancelled?: boolean;
  /** Both endpoints within the EU/EEA — caps compensation at €400 (Art. 7(1)(b)). */
  intraEu?: boolean;
}

export interface CompensationResult {
  eligible: boolean;
  amount?: { value: number; currency: string };
  note: string;
}

export function estimateCompensation(i: CompensationInput): CompensationResult {
  if (i.region === 'EU') {
    if (!i.cancelled && i.delayHours < 3) {
      return { eligible: false, note: 'EU261 pays out for arrival delays of 3h+ or cancellations (<14 days notice).' };
    }
    // Base amount by great-circle distance. Art. 7(1)(b): ALL intra-EU flights
    // over 1500 km are €400 regardless of distance; the €600 tier is only for
    // non-intra-EU flights over 3500 km.
    let value = i.distanceKm <= 1500 ? 250 : i.intraEu || i.distanceKm <= 3500 ? 400 : 600;
    // Art. 7(2): non-intra-EU >3500 km delays of 3–4h are halved to €300.
    if (!i.cancelled && !i.intraEu && i.distanceKm > 3500 && i.delayHours < 4) value = 300;
    return {
      eligible: true,
      amount: { value, currency: 'EUR' },
      note: 'EU261 covers EU departures (any airline) and EU-carrier arrivals into the EU. The airline may contest for extraordinary circumstances (weather, ATC, strikes).',
    };
  }
  if (i.region === 'US') {
    if (i.cancelled) {
      return { eligible: true, note: 'US DOT: you are owed a full refund if you choose not to be rebooked — no fixed cash amount for delays.' };
    }
    return { eligible: false, note: 'US DOT mandates no cash compensation for delays. Ask the airline about meal/hotel vouchers and free rebooking.' };
  }
  return { eligible: false, note: 'No standard statutory cash-compensation scheme applies to this route.' };
}
