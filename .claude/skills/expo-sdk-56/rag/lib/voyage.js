'use strict';

// Voyage AI embeddings client (REST, zero deps — uses Node 18+ global fetch).
// Contract (verified against https://docs.voyageai.com/reference/embeddings-api):
//   POST https://api.voyageai.com/v1/embeddings
//   Authorization: Bearer $VOYAGE_API_KEY
//   body: { input: string[] (<=1000), model, input_type: "document"|"query" }
//   resp: { data: [{ index, embedding: number[] }], usage: {...} }
//
// A deterministic offline "fake" mode (RAG_FAKE_EMBEDDINGS=1 or opts.fake) lets
// the whole pipeline be built + queried without a key or network — used for
// self-tests. Fake vectors are a hashed bag-of-words, so shared vocabulary →
// higher cosine, which is enough to prove ranking works.

const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MODEL = process.env.VOYAGE_MODEL || 'voyage-4';
const FAKE_DIM = 256;

// Batch limits: Voyage allows <=1000 inputs; we also cap chars/request to stay
// well under the per-request token ceiling.
const MAX_BATCH_ITEMS = 96;
const MAX_BATCH_CHARS = 90000;
const MAX_RETRIES = 4;

function isFake(opts = {}) {
  return opts.fake === true || process.env.RAG_FAKE_EMBEDDINGS === '1';
}

function fakeEmbed(text) {
  const v = new Array(FAKE_DIM).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9_]+/g) || [];
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % FAKE_DIM] += 1;
    v[Math.abs(h >>> 8) % FAKE_DIM] += 0.5;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callVoyage(texts, inputType) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      'VOYAGE_API_KEY is not set. Export it, or run with --fake for an offline ' +
      'self-test (no real embeddings).'
    );
  }
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
      });
    } catch (e) {
      lastErr = e;
      await sleep(500 * attempt);
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      return json.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }
    const bodyText = await res.text().catch(() => '');
    // Retry transient statuses; fail fast on auth/validation errors.
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Voyage ${res.status}: ${bodyText}`);
      await sleep(800 * attempt);
      continue;
    }
    throw new Error(`Voyage ${res.status}: ${bodyText}`);
  }
  throw lastErr || new Error('Voyage request failed after retries');
}

// Embed an array of texts, batching by count and char budget. Returns vectors
// aligned to input order. onProgress(done, total) is called after each batch.
async function embedTexts(texts, inputType, opts = {}) {
  if (isFake(opts)) return texts.map(fakeEmbed);

  const out = [];
  let batch = [];
  let batchChars = 0;
  const flush = async () => {
    if (!batch.length) return;
    const vecs = await callVoyage(batch, inputType);
    for (const v of vecs) out.push(v);
    batch = [];
    batchChars = 0;
    if (opts.onProgress) opts.onProgress(out.length, texts.length);
  };
  for (const t of texts) {
    const len = t.length;
    if (batch.length >= MAX_BATCH_ITEMS || (batchChars + len > MAX_BATCH_CHARS && batch.length)) {
      await flush();
    }
    batch.push(t);
    batchChars += len;
  }
  await flush();
  return out;
}

function embedDocuments(texts, opts = {}) {
  return embedTexts(texts, 'document', opts);
}

async function embedQuery(text, opts = {}) {
  const [vec] = await embedTexts([text], 'query', opts);
  return vec;
}

function modelName(opts = {}) {
  return isFake(opts) ? `fake-bow-${FAKE_DIM}` : MODEL;
}

module.exports = { embedDocuments, embedQuery, embedTexts, modelName, isFake, FAKE_DIM };
