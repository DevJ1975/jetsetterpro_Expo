// Provider selection — FLIGHT_PROVIDER env var picks the primary status
// source (default aerodatabox); FlightAware swaps in with one env change +
// its secret. OpenSky is a position-only supplement, not a primary.
const aerodatabox = require('./aerodatabox');
const flightaware = require('./flightaware');

function statusProvider() {
  return (process.env.FLIGHT_PROVIDER || 'aerodatabox') === 'flightaware'
    ? flightaware
    : aerodatabox;
}

module.exports = { statusProvider };
