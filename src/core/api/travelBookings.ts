import { authedPost } from './backend';

// Client for Duffel Stays (hotels) + Cars (rental) via the `duffelApi` Cloud
// Function — book/cancel commits happen only after the user's confirmation tap
// (staged in IRIS), mirroring the flight-booking safety model.

export interface StaySearchResult {
  id: string; // ssr_… search-result id
  name?: string;
  rating?: number;
  amount?: string;
  currency?: string;
  expiresAt?: string;
}
export interface StayQuote {
  id: string;
  roomName?: string;
  amount?: string;
  currency?: string;
  refundable?: boolean;
  freeCancelBy?: string | null;
  expiresAt?: string;
}
export interface CarSearchResult {
  rateId: string;
  car?: string;
  category?: string;
  transmission?: string;
  seats?: number;
  supplier?: string;
  amount?: string;
  currency?: string;
  mileage?: string;
}
export interface CarQuote {
  id: string;
  amount?: string;
  currency?: string;
  conditions?: string[];
}
export interface ProductBooking {
  id: string;
  reference?: string;
  status?: string;
  amount?: string;
  currency?: string;
  cancelled?: boolean;
  accommodationName?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

// ── Stays ──
export function searchStays(p: {
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  rooms?: number;
  guests?: { type: string }[];
  radiusKm?: number;
}) {
  return authedPost<{ results: StaySearchResult[] }>('duffelApi', { op: 'searchStays', ...p });
}
export function quoteStay(searchResultId: string) {
  return authedPost<{ quote: StayQuote }>('duffelApi', { op: 'quoteStay', searchResultId });
}
export function bookStay(quoteId: string, guest: Record<string, unknown>) {
  return authedPost<{ booking: ProductBooking }>('duffelApi', { op: 'bookStay', quoteId, guest });
}
export function cancelStay(bookingId: string) {
  return authedPost<{ booking: ProductBooking }>('duffelApi', { op: 'cancelStay', bookingId });
}
export function listStays() {
  return authedPost<{ bookings: ProductBooking[] }>('duffelApi', { op: 'listStays' });
}

// ── Cars ──
export function searchCars(p: {
  pickup: { latitude: number; longitude: number };
  dropoff?: { latitude: number; longitude: number };
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  driverAge?: number;
}) {
  return authedPost<{ results: CarSearchResult[] }>('duffelApi', { op: 'searchCars', ...p });
}
export function quoteCar(rateId: string) {
  return authedPost<{ quote: CarQuote }>('duffelApi', { op: 'quoteCar', rateId });
}
export function bookCar(quoteId: string, driver: Record<string, unknown>) {
  return authedPost<{ booking: ProductBooking }>('duffelApi', { op: 'bookCar', quoteId, driver });
}
export function cancelCar(bookingId: string) {
  return authedPost<{ booking: ProductBooking }>('duffelApi', { op: 'cancelCar', bookingId });
}
export function listCars() {
  return authedPost<{ bookings: ProductBooking[] }>('duffelApi', { op: 'listCars' });
}
