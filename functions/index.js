// aiIris — a thin, authenticated streaming proxy to the Anthropic Messages API.
// The ANTHROPIC_API_KEY lives ONLY here (never in the app bundle). The client
// owns the system prompt, tool catalog, and the tool-execution loop; this
// function verifies the caller's Firebase ID token and pipes Claude's SSE back.
//
// Deploy:  firebase deploy --only functions
// Secret:  firebase functions:secrets:set ANTHROPIC_API_KEY
// Then set EXPO_PUBLIC_AI_ENDPOINT to the function's URL.
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ALLOWED_MODELS = new Set(['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001']);
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_MESSAGES = 60;
const MIN_TOKENS = 64;
const MAX_TOKENS = 4096;

// Best-effort per-user rate limit (in-memory, per instance — a Firestore-backed
// limiter is the follow-up for hard guarantees).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map();
function rateLimited(uid, now) {
  const recent = (hits.get(uid) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(uid, recent);
    return true;
  }
  recent.push(now);
  hits.set(uid, recent);
  return false;
}

exports.aiIris = onRequest({ secrets: ['ANTHROPIC_API_KEY'], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  let user;
  try {
    user = await admin.auth().verifyIdToken(m[1]);
  } catch {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'ai_unconfigured' });
    return;
  }

  if (rateLimited(user.uid, Date.now())) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'messages_required' });
    return;
  }
  if (body.messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: 'too_many_messages' });
    return;
  }

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const maxTokens = Math.max(
    MIN_TOKENS,
    Math.min(MAX_TOKENS, typeof body.max_tokens === 'number' ? body.max_tokens : 1024),
  );
  const payload = {
    model,
    max_tokens: maxTokens,
    system: body.system,
    messages: body.messages,
    tools: body.tools,
    tool_choice: body.tool_choice,
    stream: body.stream !== false,
  };

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    res.status(502).json({ error: 'ai_upstream_error' });
    return;
  }

  res.status(upstream.status);
  res.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  res.set('Cache-Control', 'no-cache');

  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value, { stream: true }));
  }
  res.end();
});
