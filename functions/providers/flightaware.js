// FlightAware AeroAPI — the post-beta quality upgrade. Implements the same
// provider interface as aerodatabox.js; swap in by setting FLIGHT_PROVIDER=
// flightaware and the FLIGHTAWARE_API_KEY secret. Left minimal on purpose:
// the beta ships on AeroDataBox.
const BASE = 'https://aeroapi.flightaware.com/aeroapi';

function mapStatus(f) {
  if (f.cancelled) return 'cancelled';
  if (f.diverted) return 'diverted';
  if (f.actual_on) return 'arrived';
  if (f.actual_off) return 'enroute';
  if (f.departure_delay && f.departure_delay > 900) return 'delayed';
  return 'scheduled';
}

async function getStatus(ident, date) {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) {
    const err = new Error('flight_data_unconfigured');
    err.code = 'unconfigured';
    throw err;
  }
  const url = `${BASE}/flights/${encodeURIComponent(ident)}?start=${date}&end=${date}T23:59:59Z`;
  const res = await fetch(url, { headers: { 'x-apikey': key } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`flightaware_${res.status}`);
    err.code = 'upstream';
    throw err;
  }
  const body = await res.json();
  const f = body.flights && body.flights[0];
  if (!f) return null;
  const times = (sched, est, act) => {
    const t = {};
    if (sched) t.scheduled = sched;
    if (est) t.estimated = est;
    if (act) t.actual = act;
    return t;
  };
  return {
    ident,
    airline: f.operator ? { iata: f.operator_iata, name: f.operator } : undefined,
    date,
    status: mapStatus(f),
    delayMin: f.departure_delay ? Math.max(0, Math.round(f.departure_delay / 60)) : undefined,
    origin: {
      iata: (f.origin && (f.origin.code_iata || f.origin.code)) || '',
      name: f.origin && f.origin.name,
      city: f.origin && f.origin.city,
      terminal: f.terminal_origin,
      gate: f.gate_origin,
      times: times(f.scheduled_out, f.estimated_out, f.actual_out),
    },
    destination: {
      iata: (f.destination && (f.destination.code_iata || f.destination.code)) || '',
      name: f.destination && f.destination.name,
      city: f.destination && f.destination.city,
      terminal: f.terminal_destination,
      gate: f.gate_destination,
      baggageClaim: f.baggage_claim,
      times: times(f.scheduled_in, f.estimated_in, f.actual_in),
    },
    aircraft: { model: f.aircraft_type, reg: f.registration },
    position: null,
    source: 'flightaware',
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { name: 'flightaware', getStatus };
