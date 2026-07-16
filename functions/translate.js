// translate — free-text translation through Google Cloud Translation v2,
// authenticated with the function's own service account (ADC) — no API key.
// Enable the Cloud Translation API on the Firebase/GCP project once.
//
//   POST { text, target, source? }  → { translated, detectedSource? }
//
// Budgets keep the project inside the free 500k chars/month: 2k chars/call,
// 20k/day per user, 450k/month globally.
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');

const limited = makeLimiter(10, 60_000);
const MAX_CHARS = 2000;
const DAILY_USER_CHARS = 20_000;
const MONTHLY_GLOBAL_CHARS = 450_000;
const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-translation'] });

async function withinBudgets(uid, chars) {
  const db = admin.firestore();
  const now = new Date();
  const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const month = day.slice(0, 6);
  const userRef = db.collection('usage').doc(`translate_${uid}_${day}`);
  const globalRef = db.collection('usage').doc(`translate_global_${month}`);
  return db.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const userChars = ((u.exists && u.data().chars) || 0) + chars;
    const globalChars = ((g.exists && g.data().chars) || 0) + chars;
    if (userChars > DAILY_USER_CHARS || globalChars > MONTHLY_GLOBAL_CHARS) return false;
    tx.set(userRef, { chars: userChars }, { merge: true });
    tx.set(globalRef, { chars: globalChars }, { merge: true });
    return true;
  });
}

const translate = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await verifyBearer(req, res);
  if (!user) return;
  if (limited(user.uid)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const { text, target, source } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text_required' });
    return;
  }
  if (text.length > MAX_CHARS) {
    res.status(400).json({ error: 'too_long' });
    return;
  }
  if (typeof target !== 'string' || !LANG_RE.test(target) || (source && !LANG_RE.test(source))) {
    res.status(400).json({ error: 'bad_language' });
    return;
  }

  if (!(await withinBudgets(user.uid, text.length))) {
    res.status(429).json({ error: 'quota_exhausted' });
    return;
  }

  let token;
  try {
    token = await auth.getAccessToken();
  } catch {
    res.status(503).json({ error: 'translate_unconfigured' });
    return;
  }

  try {
    const params = new URLSearchParams({ q: text, target, format: 'text' });
    if (source) params.set('source', source);
    const upstream = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!upstream.ok) {
      res.status(upstream.status === 403 ? 503 : 502).json({
        error: upstream.status === 403 ? 'translate_unconfigured' : 'upstream_error',
      });
      return;
    }
    const body = await upstream.json();
    const t = body.data && body.data.translations && body.data.translations[0];
    if (!t) {
      res.status(502).json({ error: 'upstream_error' });
      return;
    }
    res.json({ translated: t.translatedText, detectedSource: t.detectedSourceLanguage });
  } catch {
    res.status(502).json({ error: 'upstream_error' });
  }
});

module.exports = { translate };
