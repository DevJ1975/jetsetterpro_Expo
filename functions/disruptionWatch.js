// disruptionWatch — scheduled watcher that turns flight-status changes into
// per-user disruption events + Expo push notifications.
//
// Every 10 minutes:
//   1. Load flightWatches with depUtc in [now−6h, now+36h] and notify == true
//      (the client mirrors upcoming itinerary flights into that collection).
//   2. De-dupe by flight+date; one cache-through status lookup each — many
//      watchers of the same flight share one upstream call.
//   3. Diff vs each watch's lastSnapshot → DELAY (≥15 min slip vs last
//      notified), GATE_CHANGE, CANCELLED, DIVERTED.
//   4. Write users/{uid}/disruptions/{eventId} (idempotent ids) as the source
//      of truth, then send at most ONE coalesced push per user+flight per run
//      via the Expo Push API; DeviceNotRegistered tokens are pruned.
//
// Hardening: every flight and every watch is processed in isolation, so a
// single malformed doc or Firestore/upstream hiccup can never abort the whole
// run (which would drop alerts for every other user). Pushes are coalesced and
// prioritized to avoid notification spam, and token pruning is keyed to the
// correct document even when some token fields are empty.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { getStatusCached } = require('./lib/flightCache');
const { statusProvider } = require('./providers');

const HORIZON_BACK_MS = 6 * 3600_000;
const HORIZON_FWD_MS = 36 * 3600_000;
const DELAY_NOTIFY_MIN = 15;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100; // Expo push accepts ≤100 messages per request
// Safety backstop so a runaway watch set can't blow the 300s budget / quota.
const MAX_FLIGHTS_PER_RUN = 300;
// Higher wins when coalescing multiple new events for one user+flight into a
// single push (the full set is always written to the in-app feed regardless).
const PUSH_PRIORITY = { CANCELLED: 4, DIVERTED: 3, GATE_CHANGE: 2, DELAY: 1 };

function estDep(flight) {
  return (
    (flight.origin &&
      flight.origin.times &&
      (flight.origin.times.estimated || flight.origin.times.scheduled)) ||
    null
  );
}

function schedDep(flight) {
  return (flight.origin && flight.origin.times && flight.origin.times.scheduled) || null;
}

/** Total delay vs the (stable) scheduled departure, in minutes; 0 if unknown. */
function totalDelayMin(flight) {
  const sched = schedDep(flight);
  const est = estDep(flight);
  if (!sched || !est) return 0;
  const min = Math.round((Date.parse(est) - Date.parse(sched)) / 60000);
  return Number.isFinite(min) && min > 0 ? min : 0;
}

/** Pure diff: previous snapshot vs fresh status → list of events. */
function diffEvents(prev, flight) {
  const events = [];
  const gate = flight.origin && flight.origin.gate;
  if (flight.status === 'cancelled' && (!prev || prev.status !== 'cancelled')) {
    events.push({ kind: 'CANCELLED', message: `Flight ${flight.ident} has been cancelled.` });
  }
  if (flight.status === 'diverted' && (!prev || prev.status !== 'diverted')) {
    events.push({ kind: 'DIVERTED', message: `Flight ${flight.ident} has been diverted.` });
  }
  if (prev && prev.gate && gate && prev.gate !== gate) {
    events.push({
      kind: 'GATE_CHANGE',
      message: `Gate change for ${flight.ident}: ${prev.gate} → ${gate}.`,
      delta: { gate: [prev.gate, gate] },
    });
  }
  // Measure delay against the STABLE scheduled time, not the previous run's
  // estimate — otherwise a delay that accrues gradually (10 min per run) never
  // crosses the threshold in any single diff. Re-notify only when the total
  // delay grows by another DELAY_NOTIFY_MIN beyond what we last told the user.
  {
    const slipMin = totalDelayMin(flight);
    const notified = (prev && prev.notifiedDelayMin) || 0;
    if (slipMin >= DELAY_NOTIFY_MIN && slipMin >= notified + DELAY_NOTIFY_MIN) {
      events.push({
        kind: 'DELAY',
        message: `${flight.ident} is now delayed — departure moved ${slipMin} min later.`,
        delta: { delayMin: slipMin },
      });
    }
  }
  return events;
}

/** Send ONE best-effort push (already coalesced by the caller) to every device
 *  a user has registered. Token pruning is paired to the exact source doc so an
 *  empty token can't shift the DeviceNotRegistered index onto the wrong doc. */
async function pushToUser(db, uid, title, bodyText) {
  let tokensSnap;
  try {
    tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
  } catch (err) {
    logger.warn('disruptionWatch pushTokens read failed', { uid, err: String(err) });
    return;
  }
  const entries = tokensSnap.docs
    .map((d) => ({ ref: d.ref, token: d.data() && d.data().token }))
    .filter((e) => typeof e.token === 'string' && e.token.length > 0);
  if (!entries.length) return;

  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < entries.length; i += EXPO_BATCH) {
    const chunk = entries.slice(i, i + EXPO_BATCH);
    const messages = chunk.map((e) => ({
      to: e.token,
      title,
      body: bodyText,
      sound: 'default',
      channelId: 'disruptions',
      data: { url: '/disruption' },
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });
      const body = await res.json().catch(() => null);
      const tickets = (body && body.data) || [];
      await Promise.all(
        tickets.map(async (ticket, j) => {
          if (
            ticket &&
            ticket.status === 'error' &&
            ticket.details &&
            ticket.details.error === 'DeviceNotRegistered'
          ) {
            const gone = chunk[j]; // aligned: tickets ↔ this chunk's messages ↔ chunk entries
            if (gone) await gone.ref.delete().catch(() => {});
          }
        }),
      );
    } catch {
      // push is best-effort; the in-app disruptions feed is the source of truth
    }
  }
}

/** Process one flight's fresh status against every watch of it. Records feed
 *  events (idempotent) and queues one coalesced push per user+flight. */
async function processFlight(db, key, group, flight, pushQueue) {
  for (const w of group) {
    try {
      const events = diffEvents(w.lastSnapshot, flight);
      const delayEvent = events.find((e) => e.kind === 'DELAY');
      const snapshot = {
        status: flight.status,
        gate: (flight.origin && flight.origin.gate) || null,
        estDep: estDep(flight),
        // Carry forward the last-notified delay level so gradual slips
        // re-notify only at each new DELAY_NOTIFY_MIN step, not every run.
        notifiedDelayMin: delayEvent
          ? delayEvent.delta.delayMin
          : (w.lastSnapshot && w.lastSnapshot.notifiedDelayMin) || 0,
      };
      await w.ref.set(
        { lastSnapshot: snapshot, lastCheckedAt: new Date().toISOString() },
        { merge: true },
      );

      for (const e of events) {
        const eventId = `${key}_${e.kind}_${Buffer.from(JSON.stringify(e.delta || e.kind))
          .toString('base64url')
          .slice(0, 12)}`;
        const ref = db.collection('users').doc(w.uid).collection('disruptions').doc(eventId);
        const existing = await ref.get();
        if (existing.exists) continue; // idempotent across runs
        await ref.set({
          id: eventId,
          kind: e.kind,
          ident: w.ident,
          date: w.date,
          title: w.title || `${w.ident} · ${w.origin || ''}→${w.dest || ''}`,
          message: e.message,
          delta: e.delta || null,
          createdAt: new Date().toISOString(),
          readAt: null,
        });
        // Coalesce: at most one push per user+flight per run, the most severe.
        const qKey = `${w.uid} ${key}`;
        const prio = PUSH_PRIORITY[e.kind] || 0;
        const cur = pushQueue.get(qKey);
        if (!cur || prio > cur.prio) {
          pushQueue.set(qKey, { uid: w.uid, ident: w.ident, kind: e.kind, message: e.message, prio });
        }
      }
    } catch (err) {
      // Isolate per-watch failures so one bad doc can't drop everyone's alerts.
      logger.warn('disruptionWatch watch failed', { key, uid: w.uid, err: String(err) });
    }
  }
}

const disruptionWatch = onSchedule(
  {
    schedule: 'every 10 minutes',
    secrets: ['AERODATABOX_API_KEY', 'EXPO_ACCESS_TOKEN'],
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const snap = await db
      .collection('flightWatches')
      .where('depUtc', '>=', new Date(now - HORIZON_BACK_MS).toISOString())
      .where('depUtc', '<=', new Date(now + HORIZON_FWD_MS).toISOString())
      .get();

    const watches = snap.docs
      .map((d) => ({ ref: d.ref, ...d.data() }))
      // uid is required — a malformed doc without it would otherwise throw on
      // users/{undefined} and (pre-isolation) abort the run.
      .filter((w) => w.notify !== false && w.uid && w.ident && w.date);
    if (!watches.length) return;

    // One status lookup per unique flight.
    const byFlight = new Map();
    for (const w of watches) {
      const key = `${w.ident}_${w.date}`;
      if (!byFlight.has(key)) byFlight.set(key, []);
      byFlight.get(key).push(w);
    }

    let flightKeys = [...byFlight.keys()];
    if (flightKeys.length > MAX_FLIGHTS_PER_RUN) {
      logger.warn('disruptionWatch capped flights this run', {
        total: flightKeys.length,
        cap: MAX_FLIGHTS_PER_RUN,
      });
      flightKeys = flightKeys.slice(0, MAX_FLIGHTS_PER_RUN);
    }

    const provider = statusProvider();
    const pushQueue = new Map();
    for (const key of flightKeys) {
      const group = byFlight.get(key);
      let flight;
      try {
        ({ flight } = await getStatusCached(group[0].ident, group[0].date, provider));
      } catch {
        continue; // upstream hiccup — next run retries this flight
      }
      if (!flight) continue;
      await processFlight(db, key, group, flight, pushQueue);
    }

    // Flush coalesced pushes (best-effort; feed already written).
    for (const p of pushQueue.values()) {
      await pushToUser(db, p.uid, `✈ ${p.ident} — ${p.kind.replace('_', ' ').toLowerCase()}`, p.message);
    }
  },
);

module.exports = { disruptionWatch, diffEvents };
