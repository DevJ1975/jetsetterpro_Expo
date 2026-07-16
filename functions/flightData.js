// flightData — authenticated flight-status/position lookup, cache-through.
//
//   GET ?op=status&ident=AA100&date=2026-07-20   → { flight: FlightStatus }
//   GET ?op=position&ident=AA100&date=2026-07-20 → { position: FlightPosition|null }
//
// Secrets: AERODATABOX_API_KEY (+ optional OPENSKY_CLIENT_ID/SECRET,
// FLIGHTAWARE_API_KEY for the provider swap).
const { onRequest } = require('firebase-functions/v2/https');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');
const { getStatusCached, getPositionCached } = require('./lib/flightCache');
const { statusProvider } = require('./providers');
const opensky = require('./providers/opensky');

const limited = makeLimiter(20, 60_000);
const IDENT_RE = /^[A-Z0-9]{2}\d{1,4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const flightData = onRequest(
  {
    secrets: ['AERODATABOX_API_KEY', 'OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET'],
    cors: true,
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const user = await verifyBearer(req, res);
    if (!user) return;
    if (limited(user.uid)) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const op = String(req.query.op || 'status');
    const ident = String(req.query.ident || '').toUpperCase().replace(/\s+/g, '');
    const date = String(req.query.date || '');
    if (!IDENT_RE.test(ident) || !DATE_RE.test(date)) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }

    const provider = statusProvider();
    try {
      const { flight } = await getStatusCached(ident, date, provider);
      if (op === 'position') {
        if (!flight) {
          res.json({ position: null });
          return;
        }
        const position = await getPositionCached(ident, date, async () => {
          const viaOpenSky = await opensky.getPosition(flight.aircraft && flight.aircraft.icao24);
          return viaOpenSky || flight.position || null;
        });
        res.json({ position });
        return;
      }
      if (!flight) {
        res.status(404).json({ error: 'flight_not_found' });
        return;
      }
      res.json({ flight });
    } catch (err) {
      if (err && err.code === 'unconfigured') {
        res.status(503).json({ error: 'flight_data_unconfigured' });
        return;
      }
      res.status(502).json({ error: 'upstream_error' });
    }
  },
);

module.exports = { flightData };
