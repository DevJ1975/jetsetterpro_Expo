'use strict';

// Cosine similarity between two equal-length numeric vectors.
// Returns a value in [-1, 1]; higher = more similar.
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? -1 : dot / denom;
}

// Rank `items` (each has an `embedding`) by cosine vs `queryVec`, return top-k.
function topK(queryVec, items, k) {
  const scored = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    scored[i] = { item: items[i], score: cosine(queryVec, items[i].embedding) };
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}

module.exports = { cosine, topK };
