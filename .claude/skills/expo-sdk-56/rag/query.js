#!/usr/bin/env node
'use strict';

// Semantic search over the local index. Embeds the query with the SAME model
// the index was built with, then returns the top-k chunks by cosine similarity.
//
//   node query.js "how is reanimated babel configured here" --k 8
//   node query.js "expo-secure-store face id permission" --json
//   node query.js "..." --fake      # match a --fake-built index (offline self-test)
//
// Designed to be called by the SDK56 agent via Bash. Human-readable by default;
// --json emits machine-readable results.

const fs = require('fs');
const path = require('path');
const { topK } = require('./lib/cosine');
const voyage = require('./lib/voyage');

function parseArgs(argv) {
  const args = { k: 8, json: false, fake: false, query: '', indexPath: path.join(__dirname, 'index.json'), snippet: 700 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--k') args.k = parseInt(argv[++i], 10) || args.k;
    else if (a === '--json') args.json = true;
    else if (a === '--fake') args.fake = true;
    else if (a === '--index') args.indexPath = path.resolve(argv[++i]);
    else if (a === '--snippet') args.snippet = parseInt(argv[++i], 10) || args.snippet;
    else rest.push(a);
  }
  args.query = rest.join(' ').trim();
  return args;
}

function loc(c) {
  return c.kind === 'markdown'
    ? `${c.source}${c.heading ? ' › ' + c.heading : ''}`
    : `${c.source} (lines ${c.startLine}-${c.endLine})`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    process.stderr.write('Usage: node query.js "<question>" [--k N] [--json] [--fake]\n');
    process.exit(2);
  }
  if (!fs.existsSync(args.indexPath)) {
    process.stderr.write(
      `No index at ${args.indexPath}.\n` +
      `Build it first:  (cd "${__dirname}" && VOYAGE_API_KEY=... npm run build)\n` +
      `Or for an offline self-test:  npm run build:fake\n`
    );
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(args.indexPath, 'utf8'));

  // Guard: query embeddings must come from the same space as the index.
  const wantFake = args.fake || index.fake === true;
  const queryVec = await voyage.embedQuery(args.query, { fake: wantFake });
  if (queryVec.length !== index.dim) {
    process.stderr.write(
      `Dim mismatch: query ${queryVec.length} vs index ${index.dim}. ` +
      `The index was built with model "${index.model}"${index.fake ? ' (fake)' : ''}; ` +
      `query it with a matching model (set VOYAGE_MODEL / --fake accordingly).\n`
    );
    process.exit(1);
  }

  const hits = topK(queryVec, index.chunks, args.k);

  if (args.json) {
    process.stdout.write(JSON.stringify(
      hits.map((h) => ({
        score: Number(h.score.toFixed(4)),
        source: h.item.source,
        kind: h.item.kind,
        heading: h.item.heading,
        startLine: h.item.startLine,
        endLine: h.item.endLine,
        text: h.item.text,
      })),
      null, 2
    ) + '\n');
    return;
  }

  process.stdout.write(
    `Top ${hits.length} for: "${args.query}"  ` +
    `(model: ${index.model}${index.fake ? ', FAKE' : ''}, index: ${index.count} chunks)\n\n`
  );
  hits.forEach((h, i) => {
    const c = h.item;
    let snippet = c.text.trim();
    if (snippet.length > args.snippet) snippet = snippet.slice(0, args.snippet) + ' …';
    snippet = snippet.split('\n').map((l) => '    ' + l).join('\n');
    process.stdout.write(`[${i + 1}] score=${h.score.toFixed(3)}  ${loc(c)}\n${snippet}\n\n`);
  });
}

main().catch((err) => {
  process.stderr.write(`\n[query] ${err.message}\n`);
  process.exit(1);
});
