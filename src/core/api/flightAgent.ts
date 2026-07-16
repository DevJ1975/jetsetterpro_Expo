import { authedPost } from './backend';
import type { OfferSearchParams } from './duffel';

// Client for the `flightAgent` Cloud Function — the Genkit-powered flight
// search-and-rank specialist behind IRIS's in-chat booking. Read-only: it
// searches and ranks live Duffel offers server-side (where the full data
// lives) and returns a compact shortlist; booking/cancel commits go through
// `duffelApi` only after the user's explicit confirmation tap.

export interface RankedOffer {
  offerId: string;
  totalAmount: string;
  totalCurrency: string;
  carrier?: string;
  carrierIata?: string;
  departISO?: string;
  arriveISO?: string;
  stops: number;
  durationISO?: string;
  expiresAt?: string;
  reason?: string;
}

export interface SearchAndRankResult {
  summary: string;
  topOffers: RankedOffer[];
  searchedAt: string;
}

export interface FlightAgentSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass?: OfferSearchParams['cabinClass'];
  /** Free-text traveler preferences, e.g. "cheapest nonstop, morning departure". */
  preferences?: string;
}

export async function searchFlightsViaAgent(
  params: FlightAgentSearchParams,
): Promise<SearchAndRankResult> {
  return authedPost<SearchAndRankResult>('flightAgent', { task: 'searchAndRank', ...params });
}
