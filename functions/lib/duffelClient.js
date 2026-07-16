// duffelClient — shared Duffel API plumbing used by both `duffelApi` (the
// booking REST endpoint) and `flightAgent` (the Genkit search-and-rank
// specialist behind IRIS). Pure extraction from duffel.js: same helper, same
// validation, same offer summarizer — so both functions speak one dialect.
const admin = require('firebase-admin');

const BASE = 'https://api.duffel.com';
const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OFFER_ID_RE = /^off_[A-Za-z0-9]+$/;
const ORDER_ID_RE = /^ord_[A-Za-z0-9]+$/;
const CANCELLATION_ID_RE = /^ore_[A-Za-z0-9]+$/;

async function duffel(path, { method = 'GET', body } = {}) {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) {
    const err = new Error('duffel_unconfigured');
    err.code = 'unconfigured';
    throw err;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify({ data: body }) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`duffel_${res.status}`);
    err.code = 'upstream';
    err.status = res.status;
    err.details = json && json.errors;
    throw err;
  }
  return json.data;
}

function ordersRef(uid) {
  return admin.firestore().collection('users').doc(uid).collection('duffelOrders');
}

/** Per-user Firestore subcollection for a Duffel product's bookings. */
function bookingsRef(uid, product) {
  // product: 'staysBookings' | 'carsBookings'
  return admin.firestore().collection('users').doc(uid).collection(product);
}

function badRequest() {
  const err = new Error('bad_request');
  err.code = 'bad_request';
  return err;
}

async function searchOffersOp(body) {
  const { origin, destination, departureDate, returnDate, passengers, cabinClass } = body;
  if (!IATA_RE.test(origin || '') || !IATA_RE.test(destination || '') || !DATE_RE.test(departureDate || '')) {
    throw badRequest();
  }
  const slices = [{ origin, destination, departure_date: departureDate }];
  if (returnDate) {
    if (!DATE_RE.test(returnDate)) throw badRequest();
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }
  const pax = Array.isArray(passengers) && passengers.length ? passengers.slice(0, 9) : [{ type: 'adult' }];
  const request = await duffel('/air/offer_requests?return_offers=true', {
    method: 'POST',
    body: {
      slices,
      passengers: pax,
      cabin_class: ['economy', 'premium_economy', 'business', 'first'].includes(cabinClass)
        ? cabinClass
        : 'economy',
    },
  });
  // Trim to what the results list renders; the full offer is re-fetched by id.
  const offers = (request.offers || []).slice(0, 20).map((o) => ({
    id: o.id,
    total_amount: o.total_amount,
    total_currency: o.total_currency,
    expires_at: o.expires_at,
    owner: o.owner && { name: o.owner.name, iata_code: o.owner.iata_code, logo_symbol_url: o.owner.logo_symbol_url },
    slices: (o.slices || []).map((s) => ({
      origin: s.origin && s.origin.iata_code,
      destination: s.destination && s.destination.iata_code,
      duration: s.duration,
      segments: (s.segments || []).map((seg) => ({
        operating_carrier: seg.operating_carrier && seg.operating_carrier.name,
        marketing_carrier_flight_number: `${(seg.marketing_carrier && seg.marketing_carrier.iata_code) || ''}${seg.marketing_carrier_flight_number || ''}`,
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
        origin: seg.origin && seg.origin.iata_code,
        destination: seg.destination && seg.destination.iata_code,
      })),
    })),
    passengers: (request.passengers || []).map((p) => ({ id: p.id, type: p.type })),
  }));
  return { requestId: request.id, offers };
}

module.exports = {
  duffel,
  ordersRef,
  bookingsRef,
  badRequest,
  searchOffersOp,
  IATA_RE,
  DATE_RE,
  OFFER_ID_RE,
  ORDER_ID_RE,
  CANCELLATION_ID_RE,
};
