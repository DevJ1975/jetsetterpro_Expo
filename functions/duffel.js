// duffelApi — authenticated proxy to the Duffel flights API (test mode for
// beta: full booking flow, no real tickets). The DUFFEL_API_KEY secret stays
// server-side; order ownership is enforced per user via
// users/{uid}/duffelOrders/{orderId} before any read/cancel.
//
//   POST { op: 'searchOffers', origin, destination, departureDate,
//          returnDate?, passengers: [{type|age}...], cabinClass? }
//   POST { op: 'getOffer', offerId }            → offer w/ available services
//   POST { op: 'seatMaps', offerId }            → { seat_maps }
//   POST { op: 'createOrder', payload }         → order (payload from
//          DuffelAncillaries onPayloadReady; server attaches balance payment)
//   POST { op: 'listOrders' }                   → this user's orders
//   POST { op: 'cancelOrder', orderId }         → confirmed cancellation
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');

const BASE = 'https://api.duffel.com';
const limited = makeLimiter(15, 60_000);
const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

async function searchOffers(body) {
  const { origin, destination, departureDate, returnDate, passengers, cabinClass } = body;
  if (!IATA_RE.test(origin || '') || !IATA_RE.test(destination || '') || !DATE_RE.test(departureDate || '')) {
    const err = new Error('bad_request');
    err.code = 'bad_request';
    throw err;
  }
  const slices = [{ origin, destination, departure_date: departureDate }];
  if (returnDate) {
    if (!DATE_RE.test(returnDate)) {
      const err = new Error('bad_request');
      err.code = 'bad_request';
      throw err;
    }
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

async function handle(uid, body) {
  switch (body.op) {
    case 'searchOffers':
      return searchOffers(body);
    case 'getOffer': {
      if (!/^off_[A-Za-z0-9]+$/.test(body.offerId || '')) throw badRequest();
      const offer = await duffel(
        `/air/offers/${body.offerId}?return_available_services=true`,
      );
      return { offer };
    }
    case 'seatMaps': {
      if (!/^off_[A-Za-z0-9]+$/.test(body.offerId || '')) throw badRequest();
      const seatMaps = await duffel(`/air/seat_maps?offer_id=${body.offerId}`);
      return { seat_maps: seatMaps };
    }
    case 'createOrder': {
      const payload = body.payload;
      if (!payload || !Array.isArray(payload.selected_offers) || !payload.selected_offers.length)
        throw badRequest();
      // Recompute the charge server-side from the fresh offer + chosen services
      // — never trust a client-supplied amount.
      const offer = await duffel(
        `/air/offers/${payload.selected_offers[0]}?return_available_services=true`,
      );
      const servicePrices = new Map(
        (offer.available_services || []).map((s) => [s.id, Number(s.total_amount)]),
      );
      const servicesTotal = (payload.services || []).reduce(
        (sum, s) => sum + (servicePrices.get(s.id) || 0) * (s.quantity || 1),
        0,
      );
      const total = (Number(offer.total_amount) + servicesTotal).toFixed(2);
      const order = await duffel('/air/orders', {
        method: 'POST',
        body: {
          type: 'instant',
          selected_offers: payload.selected_offers,
          services: payload.services,
          passengers: payload.passengers,
          payments: [{ type: 'balance', currency: offer.total_currency, amount: total }],
          metadata: { uid },
        },
      });
      await ordersRef(uid)
        .doc(order.id)
        .set({
          id: order.id,
          bookingReference: order.booking_reference,
          totalAmount: order.total_amount,
          totalCurrency: order.total_currency,
          createdAt: order.created_at,
          cancelled: false,
          slices: (order.slices || []).map((s) => ({
            origin: s.origin && s.origin.iata_code,
            destination: s.destination && s.destination.iata_code,
            departingAt:
              s.segments && s.segments[0] && s.segments[0].departing_at,
          })),
        });
      return { order: { id: order.id, booking_reference: order.booking_reference, total_amount: order.total_amount, total_currency: order.total_currency } };
    }
    case 'listOrders': {
      const snap = await ordersRef(uid).orderBy('createdAt', 'desc').limit(25).get();
      return { orders: snap.docs.map((d) => d.data()) };
    }
    case 'cancelOrder': {
      const orderId = body.orderId || '';
      if (!/^ord_[A-Za-z0-9]+$/.test(orderId)) throw badRequest();
      const owned = await ordersRef(uid).doc(orderId).get();
      if (!owned.exists) {
        const err = new Error('not_found');
        err.code = 'not_found';
        throw err;
      }
      const cancellation = await duffel('/air/order_cancellations', {
        method: 'POST',
        body: { order_id: orderId },
      });
      const confirmed = await duffel(
        `/air/order_cancellations/${cancellation.id}/actions/confirm`,
        { method: 'POST' },
      );
      await ordersRef(uid).doc(orderId).set(
        { cancelled: true, refundAmount: confirmed.refund_amount, refundCurrency: confirmed.refund_currency },
        { merge: true },
      );
      return {
        cancellation: {
          id: confirmed.id,
          refund_amount: confirmed.refund_amount,
          refund_currency: confirmed.refund_currency,
        },
      };
    }
    default:
      throw badRequest();
  }
}

function badRequest() {
  const err = new Error('bad_request');
  err.code = 'bad_request';
  return err;
}

const duffelApi = onRequest({ secrets: ['DUFFEL_API_KEY'], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await verifyBearer(req, res);
  if (!user) return;
  if (limited(user.uid)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }
  try {
    res.json(await handle(user.uid, req.body || {}));
  } catch (err) {
    const code = err && err.code;
    if (code === 'bad_request') res.status(400).json({ error: 'bad_request' });
    else if (code === 'not_found') res.status(404).json({ error: 'not_found' });
    else if (code === 'unconfigured') res.status(503).json({ error: 'duffel_unconfigured' });
    else res.status(502).json({ error: 'upstream_error', details: err && err.details });
  }
});

module.exports = { duffelApi };
