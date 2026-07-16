// stateDept — cached proxy to U.S. Department of State / Bureau of Consular
// Affairs public data (CC-BY). Currently serves Travel Advisories (Level 1–4).
//
//   GET ?op=advisory&country=FR[&name=France]  → { advisory: Advisory | null }
//
// The full advisories list is fetched ONCE and shared across all users AND all
// countries — one upstream call per freshness window — then filtered per
// request. No API key is required (public CC-BY data); attribution is returned
// in every response and MUST be shown in the UI to satisfy the licence.
//
// ⚠️ ENDPOINT UNVERIFIED FROM THE BUILD SANDBOX: cadataapi.state.gov is network-
// blocked in CI/agent environments, so the URL + response shape below were
// derived from State's public docs + open-data mirrors and MUST be confirmed
// against a live response on first deploy. The normalizer is deliberately
// tolerant of several field spellings/containers; adjust if the live payload
// differs (check the Cloud Functions logs — a shape mismatch logs the keys).
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');

const ADVISORIES_URL = 'https://cadataapi.state.gov/api/TravelAdvisories';
const FALLBACK_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
const LIST_TTL_MS = 12 * 3600_000; // advisories change slowly (event-driven)
const PURGE_AFTER_MS = 30 * 24 * 3600_000;
const SOURCE = 'U.S. Department of State, Bureau of Consular Affairs';
const USER_AGENT = 'JetSetterPro/1.0 (travel advisory display; +https://jetsetter.pro)';
const ISO2_RE = /^[A-Za-z]{2}$/;

const LEVEL_LABEL = {
  1: 'Exercise Normal Precautions',
  2: 'Exercise Increased Caution',
  3: 'Reconsider Travel',
  4: 'Do Not Travel',
};

const limited = makeLimiter(30, 60_000);

function db() {
  return admin.firestore();
}

/** Pull an advisory level 1–4 out of a structured field or a title string. */
function extractLevel(entry) {
  const direct = Number(entry.Level ?? entry.level ?? entry.advisoryLevel);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 4) return direct;
  const text = String(
    entry.Title ?? entry.title ?? entry.Summary ?? entry.summary ?? entry.Advisory ?? '',
  );
  const m = text.match(/Level\s*([1-4])/i);
  return m ? Number(m[1]) : 0;
}

/** Normalize one upstream entry to a stable shape (tolerant of field naming). */
function normalizeEntry(entry) {
  const iso = String(
    entry.ISO ?? entry.iso ?? entry.CountryCode ?? entry.countryCode ?? entry.ISOCode ?? '',
  )
    .trim()
    .toUpperCase();
  const name = String(
    entry.Country ?? entry.country ?? entry.CountryName ?? entry.Name ?? entry.name ?? '',
  ).trim();
  const title = String(entry.Title ?? entry.title ?? name);
  const url = String(entry.Link ?? entry.link ?? entry.URL ?? entry.url ?? '');
  const updated = String(
    entry.Date ?? entry.date ?? entry.PubDate ?? entry.pubDate ?? entry.Published ?? entry.published ?? '',
  );
  return { iso, name: name || title, level: extractLevel(entry), title, url, updated };
}

async function fetchList() {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(ADVISORIES_URL, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = await res.json();
    // Tolerate a bare array, or {data|Advisories|advisories|value: [...]}.
    const raw = Array.isArray(body)
      ? body
      : (body && (body.data ?? body.Advisories ?? body.advisories ?? body.value)) ?? [];
    if (!Array.isArray(raw) || raw.length === 0) {
      logger.warn('stateDept: unexpected advisories payload shape', {
        keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 12) : typeof body,
      });
      return [];
    }
    return raw.map(normalizeEntry).filter((e) => e.name || e.iso);
  } finally {
    clearTimeout(to);
  }
}

/** Cache-through the whole advisories list (one shared entry for everyone). */
async function getListCached() {
  const ref = db().collection('stateDeptCache').doc('advisories');
  const now = Date.now();
  const snap = await ref.get();
  const cached = snap.exists ? snap.data() : null;
  if (cached && now < cached.freshUntil && Array.isArray(cached.list)) return cached.list;
  try {
    const list = await fetchList();
    await ref.set({
      list,
      fetchedAt: now,
      freshUntil: now + LIST_TTL_MS,
      purgeAt: admin.firestore.Timestamp.fromMillis(now + PURGE_AFTER_MS),
    });
    return list;
  } catch (err) {
    if (cached && Array.isArray(cached.list)) return cached.list; // serve stale on upstream hiccup
    throw err;
  }
}

/** Match the requested country by ISO first, then by exact/loose name. */
function pick(list, iso, name) {
  const wantIso = iso.toUpperCase();
  const wantName = name.trim().toLowerCase();
  let hit = list.find((e) => e.iso && e.iso === wantIso);
  if (!hit && wantName) hit = list.find((e) => e.name.toLowerCase() === wantName);
  if (!hit && wantName) {
    hit = list.find(
      (e) =>
        e.name && (e.name.toLowerCase().includes(wantName) || wantName.includes(e.name.toLowerCase())),
    );
  }
  return hit || null;
}

const stateDept = onRequest({ cors: true }, async (req, res) => {
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

  const op = String(req.query.op || 'advisory');
  if (op !== 'advisory') {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  const country = String(req.query.country || '').trim();
  const name = String(req.query.name || '').trim();
  if (!ISO2_RE.test(country)) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  try {
    const list = await getListCached();
    const hit = pick(list, country, name);
    if (!hit || !hit.level) {
      res.json({ advisory: null });
      return;
    }
    res.json({
      advisory: {
        country: country.toUpperCase(),
        level: hit.level,
        label: LEVEL_LABEL[hit.level] || '',
        headline: hit.title,
        url: hit.url || FALLBACK_URL,
        updated: hit.updated || null,
        source: SOURCE,
      },
    });
  } catch {
    res.status(502).json({ error: 'upstream_error' });
  }
});

module.exports = { stateDept, normalizeEntry, extractLevel, pick };
