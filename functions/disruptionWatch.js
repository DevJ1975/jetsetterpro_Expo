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
//   4. Write users/{uid}/disruptions/{eventId} (idempotent ids) and push via
//      the Expo Push API to users/{uid}/pushTokens; DeviceNotRegistered
//      tokens are pruned.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { getStatusCached } = require('./lib/flightCache');
const { statusProvider } = require('./providers');

const HORIZON_BACK_MS = 6 * 3600_000;
const HORIZON_FWD_MS = 36 * 3600_000;
const DELAY_NOTIFY_MIN = 15;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function estDep(flight) {
  return (
    (flight.origin &&
      flight.origin.times &&
      (flight.origin.times.estimated || flight.origin.times.scheduled)) ||
    null
  );
}

/** Pure diff: previous snapshot vs fresh status → list of events. */
function diffEvents(prev, flight) {
  const events = [];
  const gate = flight.origin && flight.origin.gate;
  const dep = estDep(flight);
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
  } else if (!prev && gate == null) {
    // first snapshot with no gate — nothing to compare yet
  }
  if (prev && prev.estDep && dep) {
    const slipMin = Math.round((Date.parse(dep) - Date.parse(prev.estDep)) / 60000);
    if (slipMin >= DELAY_NOTIFY_MIN) {
      events.push({
        kind: 'DELAY',
        message: `${flight.ident} is now delayed — departure moved ${slipMin} min later.`,
        delta: { delayMin: slipMin },
      });
    }
  }
  return events;
}

async function pushToUser(db, uid, title, bodyText) {
  const tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
  const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({
    to,
    title,
    body: bodyText,
    sound: 'default',
    channelId: 'disruptions',
    data: { url: '/disruption' },
  }));
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
    const body = await res.json().catch(() => null);
    const tickets = (body && body.data) || [];
    await Promise.all(
      tickets.map(async (ticket, i) => {
        if (
          ticket &&
          ticket.status === 'error' &&
          ticket.details &&
          ticket.details.error === 'DeviceNotRegistered'
        ) {
          const gone = tokensSnap.docs[i];
          if (gone) await gone.ref.delete();
        }
      }),
    );
  } catch {
    // push is best-effort; the in-app disruptions feed is the source of truth
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
      .filter((w) => w.notify !== false && w.ident && w.date);
    if (!watches.length) return;

    // One status lookup per unique flight.
    const byFlight = new Map();
    for (const w of watches) {
      const key = `${w.ident}_${w.date}`;
      if (!byFlight.has(key)) byFlight.set(key, []);
      byFlight.get(key).push(w);
    }

    const provider = statusProvider();
    for (const [key, group] of byFlight) {
      let flight;
      try {
        ({ flight } = await getStatusCached(group[0].ident, group[0].date, provider));
      } catch {
        continue; // upstream hiccup — next run retries
      }
      if (!flight) continue;

      for (const w of group) {
        const events = diffEvents(w.lastSnapshot, flight);
        const snapshot = {
          status: flight.status,
          gate: (flight.origin && flight.origin.gate) || null,
          estDep: estDep(flight),
        };
        const updates = { lastSnapshot: snapshot, lastCheckedAt: new Date().toISOString() };
        await w.ref.set(updates, { merge: true });

        for (const e of events) {
          const eventId = `${key}_${e.kind}_${Buffer.from(JSON.stringify(e.delta || e.kind)).toString('base64url').slice(0, 12)}`;
          const ref = db
            .collection('users')
            .doc(w.uid)
            .collection('disruptions')
            .doc(eventId);
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
          await pushToUser(db, w.uid, `✈ ${w.ident} — ${e.kind.replace('_', ' ').toLowerCase()}`, e.message);
        }
      }
    }
  },
);

module.exports = { disruptionWatch, diffEvents };
