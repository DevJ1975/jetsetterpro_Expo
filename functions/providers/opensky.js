// OpenSky Network — free live aircraft positions by ICAO24 hex, used to
// supplement the primary provider while a flight is enroute. Optional:
// requires OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET (OAuth2 client
// credentials — basic auth retired).
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const STATES_URL = 'https://opensky-network.org/api/states/all';

let cachedToken = null; // { token, expiresAt }

async function getToken() {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    }).toString(),
  });
  if (!res.ok) return null;
  const body = await res.json();
  cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 300) * 1000 };
  return cachedToken.token;
}

/** @returns {Promise<object|null>} normalized position or null */
async function getPosition(icao24) {
  if (!icao24) return null;
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(`${STATES_URL}?icao24=${encodeURIComponent(icao24.toLowerCase())}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  const s = body.states && body.states[0];
  if (!s) return null;
  // states array: [icao24, callsign, country, time_position, last_contact,
  //   lon, lat, baro_alt_m, on_ground, velocity_ms, true_track, vert_rate, ...]
  const lon = s[5];
  const lat = s[6];
  if (lat == null || lon == null) return null;
  return {
    lat,
    lon,
    altFt: s[7] != null ? Math.round(s[7] * 3.28084) : undefined,
    speedKts: s[9] != null ? Math.round(s[9] * 1.94384) : undefined,
    heading: s[10] != null ? s[10] : undefined,
    at: new Date((s[3] || s[4] || Date.now() / 1000) * 1000).toISOString(),
  };
}

module.exports = { name: 'opensky', getPosition };
