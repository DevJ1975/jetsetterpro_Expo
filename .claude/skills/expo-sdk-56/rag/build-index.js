#!/usr/bin/env node
'use strict';

// Build (or incrementally refresh) the local vector index for the SDK56 agent.
//   node build-index.js              # incremental: reuse cached embeddings, embed only changed/new chunks
//   node build-index.js --full       # ignore cache, re-embed everything
//   node build-index.js --dry-run    # walk + chunk only; print stats, write nothing
//   node build-index.js --fake       # deterministic offline embeddings (self-test)
//   node build-index.js --out <path> # custom output file
//
// Incremental cache: each chunk carries a sha1 of (source + text). On rebuild we
// load the previous index.json, and any chunk whose hash + model still match
// reuses its stored embedding — so a typical commit re-embeds only a handful of
// chunks instead of all ~300+. This is what makes the post-commit auto-rebuild
// hook cheap enough to leave on.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildChunks, repoRootFromHere } = require('./lib/corpus');
const voyage = require('./lib/voyage');

function parseArgs(argv) {
  const args = { dryRun: false, fake: false, full: false, out: path.join(__dirname, 'index.json') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--dry') args.dryRun = true;
    else if (a === '--fake') args.fake = true;
    else if (a === '--full') args.full = true;
    else if (a === '--out') args.out = path.resolve(argv[++i]);
  }
  return args;
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

function hashChunk(c) {
  return crypto.createHash('sha1').update(c.source + '\0' + c.text).digest('hex');
}

// Map hash -> embedding from a prior index, but only if it lives in the same
// embedding space (same model + same real/fake mode). Otherwise the cache is
// unusable and we must re-embed.
function loadCache(outPath, model, fake) {
  if (!fs.existsSync(outPath)) return new Map();
  let prev;
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { return new Map(); }
  if (prev.model !== model || Boolean(prev.fake) !== Boolean(fake)) return new Map();
  const m = new Map();
  for (const c of prev.chunks || []) {
    if (c.hash && c.embedding) m.set(c.hash, c.embedding);
  }
  return m;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = repoRootFromHere();

  process.stdout.write(`Corpus root: ${repoRoot}\n`);
  const { files, chunks } = buildChunks(repoRoot);
  for (const c of chunks) c.hash = hashChunk(c);

  const totalChars = chunks.reduce((s, c) => s + c.text.length, 0);
  const byKind = chunks.reduce((m, c) => ((m[c.kind] = (m[c.kind] || 0) + 1), m), {});
  process.stdout.write(
    `Files: ${fmt(files.length)}  |  Chunks: ${fmt(chunks.length)} ` +
    `(markdown ${fmt(byKind.markdown || 0)}, code ${fmt(byKind.code || 0)})  |  ` +
    `~${fmt(Math.round(totalChars / 4))} tokens (est)\n`
  );

  if (args.dryRun) {
    process.stdout.write('\nSample chunks:\n');
    for (const c of chunks.slice(0, 3)) {
      const loc = c.kind === 'markdown' ? (c.heading || '(top)') : `lines ${c.startLine}-${c.endLine}`;
      process.stdout.write(`  • ${c.source} › ${loc} (${c.text.length} chars)\n`);
    }
    process.stdout.write('\nDry run — no embeddings, nothing written.\n');
    return;
  }

  const model = voyage.modelName(args);
  const cache = args.full ? new Map() : loadCache(args.out, model, voyage.isFake(args));

  // Split chunks into cache-hits (reuse) and misses (must embed).
  const embeddings = new Array(chunks.length);
  const missIdx = [];
  for (let i = 0; i < chunks.length; i++) {
    const hit = cache.get(chunks[i].hash);
    if (hit) embeddings[i] = hit;
    else missIdx.push(i);
  }

  const reused = chunks.length - missIdx.length;
  if (cache.size) {
    process.stdout.write(`Cache: reusing ${fmt(reused)} chunk(s), embedding ${fmt(missIdx.length)} new/changed.\n`);
  }

  if (missIdx.length) {
    process.stdout.write(`Embedding ${fmt(missIdx.length)} chunks with "${model}"...\n`);
    const texts = missIdx.map((i) => chunks[i].text);
    const vecs = await voyage.embedDocuments(texts, {
      fake: args.fake,
      onProgress: (done, total) => process.stdout.write(`\r  ${fmt(done)}/${fmt(total)} embedded`),
    });
    process.stdout.write('\n');
    if (vecs.length !== missIdx.length) {
      throw new Error(`Embedding count ${vecs.length} != miss count ${missIdx.length}`);
    }
    missIdx.forEach((i, j) => { embeddings[i] = vecs[j]; });
  } else {
    process.stdout.write('Nothing to embed — index already up to date.\n');
  }

  const index = {
    version: 1,
    model,
    fake: voyage.isFake(args),
    dim: embeddings[0] ? embeddings[0].length : 0,
    count: chunks.length,
    builtAt: new Date().toISOString(),
    chunks: chunks.map((c, i) => ({
      id: c.id,
      hash: c.hash,
      source: c.source,
      kind: c.kind,
      heading: c.heading || '',
      startLine: c.startLine,
      endLine: c.endLine,
      text: c.text,
      embedding: embeddings[i],
    })),
  };

  fs.writeFileSync(args.out, JSON.stringify(index));
  const kb = Math.round(fs.statSync(args.out).size / 1024);
  process.stdout.write(
    `\nWrote ${args.out} — ${fmt(index.count)} chunks (${fmt(reused)} reused, ` +
    `${fmt(missIdx.length)} embedded), dim ${index.dim}, ${fmt(kb)} KB\n`
  );
}

main().catch((err) => {
  process.stderr.write(`\n[build-index] ${err.message}\n`);
  process.exit(1);
});
