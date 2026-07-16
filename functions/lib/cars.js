// Duffel Cars (rental cars) ops for the duffelApi function. Lifecycle:
// search → quote → book → cancel (one-step). Launched by Duffel ~Apr 2026 on
// the same API/auth/test-mode model as flights & stays. Endpoint shapes are
// from Duffel's official JS client; owner verifies live on first deploy.
//
// Note: Cars may require Duffel to enable the product on the account — until
// then the upstream returns an error and the client shows the honest
// not-available state (graceful, like every other unconfigured provider).
const { duffel, bookingsRef, badRequest, DATE_RE } = require('./duffelClient');

const RATE_ID_RE = /^rat_[A-Za-z0-9]+$/;
const CAR_BOOKING_ID_RE = /^cbk_[A-Za-z0-9]+$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : Number(v);
}

function coord(lat, long) {
  return { latitude: num(lat), longitude: num(long) };
}

/** POST /cars/search — compact vehicle results. */
async function searchCars(body) {
  const { pickup, dropoff, pickupDate, pickupTime, dropoffDate, dropoffTime, driverAge } = body;
  if (
    !pickup ||
    !isFinite(num(pickup.latitude)) ||
    !isFinite(num(pickup.longitude)) ||
    !DATE_RE.test(pickupDate || '') ||
    !DATE_RE.test(dropoffDate || '') ||
    !TIME_RE.test(pickupTime || '') ||
    !TIME_RE.test(dropoffTime || '')
  ) {
    throw badRequest();
  }
  const drop = dropoff && isFinite(num(dropoff.latitude)) ? dropoff : pickup;
  const data = await duffel('/cars/search', {
    method: 'POST',
    body: {
      pickup_location: { geographic_coordinates: coord(pickup.latitude, pickup.longitude), radius: 20 },
      dropoff_location: { geographic_coordinates: coord(drop.latitude, drop.longitude), radius: 20 },
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      dropoff_date: dropoffDate,
      dropoff_time: dropoffTime,
      driver: { age: Math.max(18, Math.min(99, num(driverAge) || 30)) },
    },
  });
  const rows = Array.isArray(data && data.results) ? data.results : Array.isArray(data) ? data : [];
  const results = rows.slice(0, 12).map((r) => ({
    rateId: r.rate_id || r.id,
    car: r.car && r.car.name,
    category: r.car && r.car.category,
    transmission: r.car && r.car.transmission,
    seats: r.car && r.car.max_passengers,
    supplier: r.supplier && r.supplier.name,
    amount: r.total_amount,
    currency: r.total_currency,
    mileage: r.mileage && (r.mileage.unlimited ? 'unlimited' : `${r.mileage.limit} ${r.mileage.unit || ''}`),
  }));
  return { results };
}

/** POST /cars/quotes — bookable quote from a search rate id. */
async function quoteCar(body) {
  const rateId = body.rateId || '';
  if (!RATE_ID_RE.test(rateId)) throw badRequest();
  const quote = await duffel('/cars/quotes', { method: 'POST', body: { rate_id: rateId } });
  return {
    quote: {
      id: quote.id,
      amount: quote.total_amount,
      currency: quote.total_currency,
      conditions: (quote.conditions || []).map((c) => c.title).slice(0, 5),
    },
  };
}

/** POST /cars/bookings. */
async function bookCar(uid, body) {
  const { quoteId, driver } = body;
  if (
    !quoteId ||
    !driver ||
    !driver.given_name ||
    !driver.family_name ||
    !driver.date_of_birth ||
    !driver.email ||
    !driver.phone_number
  ) {
    throw badRequest();
  }
  const booking = await duffel('/cars/bookings', {
    method: 'POST',
    body: {
      quote_id: quoteId,
      driver: {
        given_name: driver.given_name,
        family_name: driver.family_name,
        date_of_birth: driver.date_of_birth,
        email: driver.email,
        phone_number: driver.phone_number,
      },
      metadata: { uid },
    },
  });
  await bookingsRef(uid, 'carsBookings').doc(booking.id).set({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    amount: booking.total_amount,
    currency: booking.total_currency,
    createdAt: booking.confirmed_at || new Date().toISOString(),
    cancelled: false,
  });
  return { booking: { id: booking.id, reference: booking.reference, status: booking.status } };
}

/** POST /cars/bookings/{id}/actions/cancel — one-step. */
async function cancelCar(uid, body) {
  const bookingId = body.bookingId || '';
  if (!CAR_BOOKING_ID_RE.test(bookingId)) throw badRequest();
  const owned = await bookingsRef(uid, 'carsBookings').doc(bookingId).get();
  if (!owned.exists) {
    const err = new Error('not_found');
    err.code = 'not_found';
    throw err;
  }
  const cancelled = await duffel(`/cars/bookings/${bookingId}/actions/cancel`, { method: 'POST' });
  await bookingsRef(uid, 'carsBookings').doc(bookingId).set(
    { cancelled: true, status: cancelled.status || 'cancelled' },
    { merge: true },
  );
  return { booking: { id: bookingId, status: cancelled.status || 'cancelled' } };
}

async function listCars(uid) {
  const snap = await bookingsRef(uid, 'carsBookings').orderBy('createdAt', 'desc').limit(25).get();
  return { bookings: snap.docs.map((d) => d.data()) };
}

module.exports = { searchCars, quoteCar, bookCar, cancelCar, listCars };
