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
//          DuffelAncillaries onPayloadReady OR IRIS bookFlight; server
//          attaches balance payment)
//   POST { op: 'listOrders' }                   → this user's orders
//   POST { op: 'cancelOrder', orderId }         → confirmed cancellation (legacy one-shot)
//   POST { op: 'quoteCancel', orderId }         → pending cancellation + refund quote
//   POST { op: 'confirmCancel', cancellationId }→ confirm a quoted cancellation
//
// Shared Duffel plumbing (fetch helper, validation, offer summarizer) lives in
// lib/duffelClient.js — also used by the flightAgent Genkit function.
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');
const {
  duffel,
  ordersRef,
  badRequest,
  searchOffersOp,
  OFFER_ID_RE,
  ORDER_ID_RE,
  CANCELLATION_ID_RE,
} = require('./lib/duffelClient');
const stays = require('./lib/stays');
const cars = require('./lib/cars');

const limited = makeLimiter(15, 60_000);

async function handle(uid, body) {
  switch (body.op) {
    case 'searchOffers':
      return searchOffersOp(body);
    case 'getOffer': {
      if (!OFFER_ID_RE.test(body.offerId || '')) throw badRequest();
      const offer = await duffel(
        `/air/offers/${body.offerId}?return_available_services=true`,
      );
      return { offer };
    }
    case 'seatMaps': {
      if (!OFFER_ID_RE.test(body.offerId || '')) throw badRequest();
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
      if (!ORDER_ID_RE.test(orderId)) throw badRequest();
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
    case 'quoteCancel': {
      // Step 1 of the two-step cancel used by IRIS: create (or reuse) a PENDING
      // Duffel cancellation so the user sees the real refund before confirming.
      // Unconfirmed quotes lapse harmlessly at their expires_at — nothing is
      // cancelled until op:'confirmCancel'.
      const orderId = body.orderId || '';
      if (!ORDER_ID_RE.test(orderId)) throw badRequest();
      const owned = await ordersRef(uid).doc(orderId).get();
      if (!owned.exists) {
        const err = new Error('not_found');
        err.code = 'not_found';
        throw err;
      }
      if (owned.data().cancelled) {
        const err = new Error('already_cancelled');
        err.code = 'already_cancelled';
        throw err;
      }
      let cancellation;
      try {
        cancellation = await duffel('/air/order_cancellations', {
          method: 'POST',
          body: { order_id: orderId },
        });
      } catch (err) {
        // A pending quote already exists → reuse the live one instead of failing.
        if (err.code === 'upstream' && err.status === 422) {
          const list = await duffel(`/air/order_cancellations?order_id=${orderId}`);
          const now = Date.now();
          cancellation = (Array.isArray(list) ? list : []).find(
            (c) => !c.confirmed_at && (!c.expires_at || Date.parse(c.expires_at) > now),
          );
          if (!cancellation) throw err;
        } else {
          throw err;
        }
      }
      return {
        cancellation: {
          id: cancellation.id,
          refund_amount: cancellation.refund_amount,
          refund_currency: cancellation.refund_currency,
          expires_at: cancellation.expires_at,
        },
      };
    }
    case 'confirmCancel': {
      // Step 2: confirm a previously quoted cancellation. Ownership is enforced
      // via the cancellation's order_id → this user's duffelOrders subtree.
      const cancellationId = body.cancellationId || '';
      if (!CANCELLATION_ID_RE.test(cancellationId)) throw badRequest();
      const quote = await duffel(`/air/order_cancellations/${cancellationId}`);
      const owned = await ordersRef(uid).doc(quote.order_id || '').get();
      if (!owned.exists) {
        const err = new Error('not_found');
        err.code = 'not_found';
        throw err;
      }
      if (quote.confirmed_at) {
        // Idempotent: already confirmed (e.g. a retried tap) — report success.
        return {
          cancellation: {
            id: quote.id,
            refund_amount: quote.refund_amount,
            refund_currency: quote.refund_currency,
          },
        };
      }
      if (quote.expires_at && Date.parse(quote.expires_at) <= Date.now()) {
        const err = new Error('quote_expired');
        err.code = 'quote_expired';
        throw err;
      }
      const confirmed = await duffel(
        `/air/order_cancellations/${cancellationId}/actions/confirm`,
        { method: 'POST' },
      );
      await ordersRef(uid).doc(quote.order_id).set(
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
    // ── Stays (hotels) ──
    case 'searchStays':
      return stays.searchStays(body);
    case 'quoteStay':
      return stays.quoteStay(body);
    case 'bookStay':
      return stays.bookStay(uid, body);
    case 'cancelStay':
      return stays.cancelStay(uid, body);
    case 'listStays':
      return stays.listStays(uid);

    // ── Cars (rental) ──
    case 'searchCars':
      return cars.searchCars(body);
    case 'quoteCar':
      return cars.quoteCar(body);
    case 'bookCar':
      return cars.bookCar(uid, body);
    case 'cancelCar':
      return cars.cancelCar(uid, body);
    case 'listCars':
      return cars.listCars(uid);

    default:
      throw badRequest();
  }
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
    else if (code === 'already_cancelled') res.status(409).json({ error: 'already_cancelled' });
    else if (code === 'quote_expired') res.status(410).json({ error: 'quote_expired' });
    else if (code === 'unconfigured') res.status(503).json({ error: 'duffel_unconfigured' });
    else res.status(502).json({ error: 'upstream_error', details: err && err.details });
  }
});

module.exports = { duffelApi };
