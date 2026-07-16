// Duffel Stays (hotels) ops for the duffelApi function. Lifecycle:
// search → fetch rates → create quote → book → cancel (one-step). Test mode
// pays from the Duffel balance. Bookings are stored per-user for ownership.
//
// Endpoint shapes are from Duffel's official JS client; unverified from the
// sandbox (network-blocked), so the owner confirms against a live test-mode
// call on first deploy — same posture as the flight ops.
const { duffel, bookingsRef, badRequest, DATE_RE } = require('./duffelClient');

const RESULT_ID_RE = /^ssr_[A-Za-z0-9]+$/;
const RATE_ID_RE = /^rat_[A-Za-z0-9]+$/;
const STAY_BOOKING_ID_RE = /^sbk_[A-Za-z0-9]+$/;

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : Number(v);
}

/** POST /stays/search — compact accommodation results. */
async function searchStays(body) {
  const { latitude, longitude, checkInDate, checkOutDate, rooms, guests, radiusKm } = body;
  const lat = num(latitude);
  const long = num(longitude);
  if (!isFinite(lat) || !isFinite(long) || !DATE_RE.test(checkInDate || '') || !DATE_RE.test(checkOutDate || '')) {
    throw badRequest();
  }
  const data = await duffel('/stays/search', {
    method: 'POST',
    body: {
      location: { geographic_coordinates: { latitude: lat, longitude: long }, radius: Math.min(20, Math.max(1, num(radiusKm) || 8)) },
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      rooms: Math.max(1, Math.min(4, num(rooms) || 1)),
      guests: Array.isArray(guests) && guests.length ? guests : [{ type: 'adult' }],
    },
  });
  const results = (data.results || data || []).slice(0, 12).map((r) => ({
    id: r.id,
    name: r.accommodation && r.accommodation.name,
    rating: r.accommodation && r.accommodation.rating,
    amount: r.cheapest_rate_total_amount,
    currency: r.cheapest_rate_currency,
    expiresAt: r.expires_at,
  }));
  return { results };
}

/** Fetch all rates for a search result, then create a bookable quote for the
 *  cheapest (prefer free-cancellation). Returns the quote for confirm-then-book. */
async function quoteStay(body) {
  const searchResultId = body.searchResultId || '';
  if (!RESULT_ID_RE.test(searchResultId)) throw badRequest();
  const rated = await duffel(`/stays/search_results/${searchResultId}/actions/fetch_all_rates`, { method: 'POST' });
  const rooms = (rated && rated.rooms) || [];
  const rates = rooms.flatMap((room) => (room.rates || []).map((rt) => ({ ...rt, roomName: room.name })));
  if (!rates.length) throw badRequest();
  // Prefer a refundable rate (non-empty cancellation timeline with a refund),
  // else the cheapest overall.
  const sorted = rates.slice().sort((a, b) => num(a.total_amount) - num(b.total_amount));
  const refundable = sorted.find(
    (r) => Array.isArray(r.cancellation_timeline) && r.cancellation_timeline.some((c) => num(c.refund_amount) > 0),
  );
  const chosen = refundable || sorted[0];
  const quote = await duffel('/stays/quotes', { method: 'POST', body: { rate_id: chosen.id } });
  const freeCancelBy =
    Array.isArray(chosen.cancellation_timeline) && chosen.cancellation_timeline.length
      ? chosen.cancellation_timeline[0].before
      : null;
  return {
    quote: {
      id: quote.id,
      roomName: chosen.roomName,
      amount: quote.total_amount || chosen.total_amount,
      currency: quote.total_currency || chosen.total_currency,
      refundable: !!refundable,
      freeCancelBy,
      expiresAt: quote.expires_at,
    },
  };
}

/** POST /stays/bookings — pay from balance in test mode. */
async function bookStay(uid, body) {
  const { quoteId, guest } = body;
  if (!quoteId || !guest || !guest.given_name || !guest.family_name || !guest.email || !guest.phone_number) {
    throw badRequest();
  }
  const booking = await duffel('/stays/bookings', {
    method: 'POST',
    body: {
      quote_id: quoteId,
      guests: [{ given_name: guest.given_name, family_name: guest.family_name }],
      email: guest.email,
      phone_number: guest.phone_number,
      accommodation_special_requests: guest.specialRequests || undefined,
      metadata: { uid },
    },
  });
  await bookingsRef(uid, 'staysBookings').doc(booking.id).set({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    accommodationName: booking.accommodation && booking.accommodation.name,
    checkInDate: booking.check_in_date,
    checkOutDate: booking.check_out_date,
    amount: booking.total_amount,
    currency: booking.total_currency,
    createdAt: booking.confirmed_at || new Date().toISOString(),
    cancelled: false,
  });
  return { booking: { id: booking.id, reference: booking.reference, status: booking.status } };
}

/** POST /stays/bookings/{id}/actions/cancel — one-step. */
async function cancelStay(uid, body) {
  const bookingId = body.bookingId || '';
  if (!STAY_BOOKING_ID_RE.test(bookingId)) throw badRequest();
  const owned = await bookingsRef(uid, 'staysBookings').doc(bookingId).get();
  if (!owned.exists) {
    const err = new Error('not_found');
    err.code = 'not_found';
    throw err;
  }
  const cancelled = await duffel(`/stays/bookings/${bookingId}/actions/cancel`, { method: 'POST' });
  await bookingsRef(uid, 'staysBookings').doc(bookingId).set(
    { cancelled: true, status: cancelled.status || 'cancelled' },
    { merge: true },
  );
  return { booking: { id: bookingId, status: cancelled.status || 'cancelled' } };
}

async function listStays(uid) {
  const snap = await bookingsRef(uid, 'staysBookings').orderBy('createdAt', 'desc').limit(25).get();
  return { bookings: snap.docs.map((d) => d.data()) };
}

module.exports = { searchStays, quoteStay, bookStay, cancelStay, listStays };
