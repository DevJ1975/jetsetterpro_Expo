// driveTime — live traffic-aware drive time from the traveler's current
// location to their departure airport, via the Google Routes API
// (computeRoutes, TRAFFIC_AWARE). Powers the home "leave by" strip and (later)
// the scheduled "leave now" push. Env-gated on GOOGLE_ROUTES_API_KEY: without
// it the function returns 503 and the client falls back to its static heuristic.
//
//   POST { originLat, originLng, airport?: IATA, destLat?, destLng? }
//   → { durationMin, staticDurationMin, distanceKm }
//
// The Routes key MUST be server-side (billable) and is NOT the Android Maps key.
const { onRequest } = require('firebase-functions/v2/https');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');
const { airportCoords } = require('./lib/airports');

const limited = makeLimiter(20, 60_000);
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function num(v) {
  return typeof v === 'number' ? v : Number(v);
}

const driveTime = onRequest({ secrets: ['GOOGLE_ROUTES_API_KEY'], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await verifyBearer(req, res);
  if (!user) return;
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'drivetime_unconfigured' });
    return;
  }
  if (limited(user.uid)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const body = req.body || {};
  const originLat = num(body.originLat);
  const originLng = num(body.originLng);
  const dest = body.airport ? airportCoords(body.airport) : { latitude: num(body.destLat), longitude: num(body.destLng) };
  if (
    !isFinite(originLat) ||
    !isFinite(originLng) ||
    !dest ||
    !isFinite(dest.latitude) ||
    !isFinite(dest.longitude)
  ) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  try {
    const upstream = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: dest.latitude, longitude: dest.longitude } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream_error' });
      return;
    }
    const route = json.routes && json.routes[0];
    if (!route) {
      res.status(502).json({ error: 'no_route' });
      return;
    }
    const secs = (s) => Math.round(parseInt(String(s || '0').replace('s', ''), 10) / 60);
    res.json({
      durationMin: secs(route.duration),
      staticDurationMin: secs(route.staticDuration),
      distanceKm: Math.round((route.distanceMeters || 0) / 100) / 10,
    });
  } catch {
    res.status(502).json({ error: 'upstream_error' });
  }
});

module.exports = { driveTime };
