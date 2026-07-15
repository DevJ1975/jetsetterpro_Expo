// Firestore-backed flight-status cache — the free-tier protector. All beta
// users share entries (key = flight + date, never uid), so N watchers of the
// same flight cost one upstream call per freshness window.
//
//   flightCache/{IDENT_YYYY-MM-DD}      { flight, fetchedAt, freshUntil, purgeAt, source }
//   flightCache/pos_{IDENT_YYYY-MM-DD}  { position, fetchedAt, freshUntil, purgeAt }
//   meta/flightQuota_{YYYYMM}           { units }  — upstream calls this month
//
// Enable a Firestore TTL policy on `purgeAt` (collection group: flightCache)
// for garbage collection; logic only trusts `freshUntil`.
const admin = require('firebase-admin');

const MONTHLY_UNIT_BUDGET = 550; // stay inside AeroDataBox Basic (~600/mo)
const PURGE_AFTER_MS = 30 * 24 * 3600_000;

const STATUS_TTL = {
  scheduleMs: 6 * 3600_000, // >6h before departure
  windowMs: 5 * 60_000, // dep−6h … arr+2h
  terminalMs: 7 * 24 * 3600_000, // arrived / cancelled
};
const POSITION_TTL_MS = 90_000;

function db() {
  return admin.firestore();
}

function cacheKey(ident, date) {
  return `${ident}_${date}`;
}

/** Freshness horizon for a status snapshot, per the flight's phase. */
function statusFreshUntil(flight, now = Date.now()) {
  const dep = Date.parse(
    flight.origin?.times?.estimated || flight.origin?.times?.scheduled || '',
  );
  const arr = Date.parse(
    flight.destination?.times?.estimated || flight.destination?.times?.scheduled || '',
  );
  const terminal =
    flight.status === 'arrived' || flight.status === 'cancelled'
      ? true
      : Number.isFinite(arr) && now > arr + 2 * 3600_000;
  if (terminal) return now + STATUS_TTL.terminalMs;
  if (Number.isFinite(dep) && now < dep - 6 * 3600_000) return now + STATUS_TTL.scheduleMs;
  return now + STATUS_TTL.windowMs;
}

async function readCache(key) {
  const snap = await db().collection('flightCache').doc(key).get();
  return snap.exists ? snap.data() : null;
}

async function writeCache(key, data, freshUntil, now = Date.now()) {
  await db()
    .collection('flightCache')
    .doc(key)
    .set({
      ...data,
      fetchedAt: now,
      freshUntil,
      purgeAt: admin.firestore.Timestamp.fromMillis(now + PURGE_AFTER_MS),
    });
}

/** Increment the monthly upstream-call counter; true when over budget. */
async function overQuota(now = new Date()) {
  const id = `flightQuota_${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ref = db().collection('meta').doc(id);
  const units = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.exists && snap.data().units) || 0) + 1;
    tx.set(ref, { units: next }, { merge: true });
    return next;
  });
  return units > MONTHLY_UNIT_BUDGET;
}

/**
 * Cache-through status lookup.
 * @param {string} ident normalized flight ident (e.g. AA100)
 * @param {string} date YYYY-MM-DD (origin-local)
 * @param {{getStatus: Function, name: string}} provider
 * @returns {Promise<{flight: object|null, stale?: boolean}>}
 */
async function getStatusCached(ident, date, provider) {
  const key = cacheKey(ident, date);
  const now = Date.now();
  const cached = await readCache(key);
  if (cached && now < cached.freshUntil && cached.flight) {
    return { flight: cached.flight };
  }

  if (await overQuota()) {
    return cached && cached.flight
      ? { flight: { ...cached.flight, stale: true }, stale: true }
      : { flight: null };
  }

  let fresh;
  try {
    fresh = await provider.getStatus(ident, date);
  } catch (err) {
    // Upstream down → serve whatever we have rather than nothing.
    if (cached && cached.flight) return { flight: { ...cached.flight, stale: true }, stale: true };
    throw err;
  }

  if (!fresh) {
    // Negative result: remember briefly so bad idents don't hammer upstream.
    await writeCache(key, { flight: null, source: provider.name }, now + 10 * 60_000, now);
    return { flight: null };
  }

  const freshUntil = statusFreshUntil(fresh, now);
  await writeCache(key, { flight: fresh, source: provider.name }, freshUntil, now);
  return { flight: fresh };
}

/** Cache-through live-position lookup (90s freshness). */
async function getPositionCached(ident, date, fetcher) {
  const key = `pos_${cacheKey(ident, date)}`;
  const now = Date.now();
  const cached = await readCache(key);
  if (cached && now < cached.freshUntil) {
    return cached.position || null;
  }
  const position = await fetcher();
  await writeCache(key, { position: position || null }, now + POSITION_TTL_MS, now);
  return position || null;
}

module.exports = { getStatusCached, getPositionCached, statusFreshUntil, MONTHLY_UNIT_BUDGET };
