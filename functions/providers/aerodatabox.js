// AeroDataBox (via RapidAPI) — the beta flight-data provider. Free/cheap
// tiers, and its flight-number endpoint returns everything the normalized
// FlightStatus needs: scheduled/revised/runway times in UTC + local, terminal,
// gate, baggage belt, status, aircraft reg/modeS, and last known position
// while enroute.
//
// Secret: AERODATABOX_API_KEY (RapidAPI key, subscribed to AeroDataBox).
const BASE = 'https://aerodatabox.p.rapidapi.com';

/** Map AeroDataBox status strings onto the normalized enum. */
function mapStatus(s, hasDeparted, hasArrived) {
  const t = (s || '').toLowerCase();
  if (t.includes('cancel')) return 'cancelled';
  if (t.includes('divert')) return 'diverted';
  if (t.includes('delay')) return 'delayed';
  if (t.includes('arrived')) return 'arrived';
  if (t.includes('enroute') || t.includes('en route') || t.includes('airborne')) return 'enroute';
  if (t.includes('boarding')) return 'boarding';
  if (t.includes('departed') || t.includes('takeoff')) return 'departed';
  if (t.includes('landed')) return 'landed';
  if (t.includes('expected') || t.includes('checkin') || t.includes('check-in') || t.includes('scheduled'))
    return 'scheduled';
  if (hasArrived) return 'arrived';
  if (hasDeparted) return 'enroute';
  return t ? 'unknown' : 'scheduled';
}

function pickTime(block, key) {
  // AeroDataBox time objects: { utc: '2026-07-20 14:35Z', local: '2026-07-20 16:35+02:00' }
  const v = block && block[key];
  if (!v) return undefined;
  const raw = v.local || v.utc;
  if (!raw) return undefined;
  // Normalize "YYYY-MM-DD HH:mm±TZ" → ISO 8601.
  return raw.replace(' ', 'T');
}

function endpoint(leg, airportBlock) {
  const times = {};
  const sched = pickTime(leg, 'scheduledTime');
  const revised = pickTime(leg, 'revisedTime') || pickTime(leg, 'predictedTime');
  const runway = pickTime(leg, 'runwayTime');
  if (sched) times.scheduled = sched;
  if (revised) times.estimated = revised;
  if (runway) times.actual = runway;
  return {
    iata: (airportBlock && (airportBlock.iata || airportBlock.icao)) || '',
    icao: airportBlock && airportBlock.icao,
    name: airportBlock && airportBlock.name,
    city: airportBlock && airportBlock.municipalityName,
    terminal: leg && leg.terminal,
    gate: leg && leg.gate,
    baggageClaim: leg && leg.baggageBelt,
    times,
  };
}

function delayMinutes(leg) {
  const sched = Date.parse(pickTime(leg, 'scheduledTime') || '');
  const rev = Date.parse(pickTime(leg, 'revisedTime') || '');
  if (!Number.isFinite(sched) || !Number.isFinite(rev)) return undefined;
  const min = Math.round((rev - sched) / 60000);
  return min > 0 ? min : undefined;
}

/** Normalize one AeroDataBox flight object. */
function normalize(f, ident, date) {
  const dep = f.departure || {};
  const arr = f.arrival || {};
  const hasDeparted = Boolean(pickTime(dep, 'runwayTime'));
  const hasArrived = Boolean(pickTime(arr, 'runwayTime'));
  const status = mapStatus(f.status, hasDeparted, hasArrived);
  const loc = f.location || null;
  return {
    ident,
    airline: f.airline ? { iata: f.airline.iata, name: f.airline.name } : undefined,
    date,
    status,
    delayMin: delayMinutes(dep),
    origin: endpoint(dep, dep.airport),
    destination: endpoint(arr, arr.airport),
    aircraft: f.aircraft
      ? { model: f.aircraft.model, reg: f.aircraft.reg, icao24: f.aircraft.modeS }
      : undefined,
    position: loc
      ? {
          lat: loc.lat,
          lon: loc.lon,
          altFt: loc.pressureAltitude && loc.pressureAltitude.feet,
          speedKts: loc.groundSpeed && loc.groundSpeed.knot,
          heading: loc.trueTrack && loc.trueTrack.deg,
          at: loc.reportedAtUtc ? loc.reportedAtUtc.replace(' ', 'T') : new Date().toISOString(),
        }
      : null,
    source: 'aerodatabox',
    fetchedAt: new Date().toISOString(),
  };
}

/** @returns normalized flight or null when unknown. Throws on upstream 5xx. */
async function getStatus(ident, date) {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) {
    const err = new Error('flight_data_unconfigured');
    err.code = 'unconfigured';
    throw err;
  }
  const url = `${BASE}/flights/number/${encodeURIComponent(ident)}/${date}?withAircraftImage=false&withLocation=true`;
  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
  });
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    const err = new Error(`aerodatabox_${res.status}`);
    err.code = 'upstream';
    throw err;
  }
  const body = await res.json();
  const flights = Array.isArray(body) ? body : [body];
  if (!flights.length || !flights[0]) return null;
  // Multiple legs can share a flight number; pick the first (primary) leg —
  // the client search UI shows date-scoped results so ambiguity is rare.
  return normalize(flights[0], ident, date);
}

module.exports = { name: 'aerodatabox', getStatus };
