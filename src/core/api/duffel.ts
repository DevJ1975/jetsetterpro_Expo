import { useMutation, useQuery } from '@tanstack/react-query';
import { authedPost, isBackendConfigured } from './backend';

// In-app flight booking via the `duffelApi` Cloud Function (Duffel test mode
// for beta — the full flow works end-to-end, no real tickets are issued).
// Seat + bag selection renders through @duffel/components in a WebView
// bridge; its onPayloadReady payload posts back here to create the order.

export interface DuffelSegment {
  operating_carrier?: string;
  marketing_carrier_flight_number?: string;
  departing_at?: string;
  arriving_at?: string;
  origin?: string;
  destination?: string;
}

export interface DuffelOfferSummary {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string;
  owner?: { name?: string; iata_code?: string; logo_symbol_url?: string };
  slices: { origin?: string; destination?: string; duration?: string; segments: DuffelSegment[] }[];
  passengers: { id: string; type: string }[];
}

export interface DuffelOrderSummary {
  id: string;
  bookingReference?: string;
  totalAmount?: string;
  totalCurrency?: string;
  createdAt?: string;
  cancelled?: boolean;
  refundAmount?: string;
  refundCurrency?: string;
  slices?: { origin?: string; destination?: string; departingAt?: string }[];
}

export interface OfferSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: { type: string }[];
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export async function searchOffers(params: OfferSearchParams) {
  return authedPost<{ requestId: string; offers: DuffelOfferSummary[] }>('duffelApi', {
    op: 'searchOffers',
    ...params,
  });
}

export async function getOffer(offerId: string) {
  // Full offer incl. available_services — the shape DuffelAncillaries needs.
  return authedPost<{ offer: Record<string, unknown> }>('duffelApi', { op: 'getOffer', offerId });
}

export async function getSeatMaps(offerId: string) {
  return authedPost<{ seat_maps: unknown[] }>('duffelApi', { op: 'seatMaps', offerId });
}

export async function createOrder(payload: unknown) {
  return authedPost<{
    order: { id: string; booking_reference?: string; total_amount?: string; total_currency?: string };
  }>('duffelApi', { op: 'createOrder', payload });
}

export async function cancelOrder(orderId: string) {
  return authedPost<{
    cancellation: { id: string; refund_amount?: string; refund_currency?: string };
  }>('duffelApi', { op: 'cancelOrder', orderId });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['duffelOrders'],
    queryFn: () => authedPost<{ orders: DuffelOrderSummary[] }>('duffelApi', { op: 'listOrders' }),
    enabled: isBackendConfigured(),
    select: (d) => d.orders,
  });
}

export function useCancelOrder() {
  return useMutation({ mutationFn: (orderId: string) => cancelOrder(orderId) });
}

export const isBookingAvailable = isBackendConfigured;
