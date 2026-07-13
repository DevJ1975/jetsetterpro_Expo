# SDK56 agent — local vector RAG

Semantic-search index that powers the **SDK56** agent (`.claude/agents/SDK56.md`).
It embeds a corpus with **Voyage AI**, stores vectors in a **local JSON file**, and
answers queries by cosine similarity. Zero runtime dependencies — pure Node 18+
(uses global `fetch`). Isolated from the Expo app: its own `package.json`, so
nothing here touches Metro / expo-doctor / the app's `node_modules`.

## Corpus (what's indexed)

- The pinned SDK 56 docs: `SKILL.md`, `references/build-and-configure.md`,
  `references/breaking-changes.md`.
- This repo's own source: everything under `app/` and `src/`
  (`.ts .tsx .js .jsx .md`), excluding `node_modules`, `ios`, `android`,
  `functions`, `dist`, `assets`, etc.

So the agent can retrieve both *what SDK 56 says* and *how this codebase uses it*.
Markdown is chunked by heading (with breadcrumb context); source is chunked into
overlapping ~50-line windows tagged with their file + line range.

## One-time setup

Requires a Voyage API key: https://dashboard.voyageai.com/

```bash
cd .claude/skills/expo-sdk-56/rag
export VOYAGE_API_KEY=pa-...            # your key
npm run build                          # embed corpus → index.json
```

Model defaults to `voyage-4`. For code-heavy retrieval you can switch:

```bash
VOYAGE_MODEL=voyage-code-3 npm run build
```

`index.json` **is committed** so teammates get semantic search without a Voyage
key (it's a ~1.4 MB derived artifact). Rebuilds are **incremental** — each chunk
is embedded once and cached by content hash, so `npm run build` after a small
change re-embeds only the handful of chunks that actually changed. Force a clean
re-embed with `npm run build -- --full`. Because it's committed, the index can
drift from the code between rebuilds: the post-commit hook refreshes it locally,
and you commit the refreshed `index.json` when you want to update the shared copy.
(Temp indexes `index.*.json`, `rebuild.log`, and the lock dir stay git-ignored.)

## Auto-rebuild on commit (git hook)

A `post-commit` hook keeps the index fresh automatically. It's installed by
pointing git at the committed hooks dir:

```bash
git config core.hooksPath .githooks   # one-time (already set if I set it up for you)
```

After any commit that touches the corpus (`app/`, `src/`, or the SDK 56 docs),
`.githooks/post-commit` launches `rebuild.sh` in the **background** — so it adds
zero latency to your commit and never fails it. The worker:

- re-embeds only changed chunks (incremental), logging to `rebuild.log`;
- self-skips (logging a note, index untouched) if `VOYAGE_API_KEY` or `node`
  isn't available — e.g. when committing from a GUI without the key in its env;
- guards against overlapping runs with a lock dir (`.rebuild.lock`, auto-cleared
  if stale > 30 min).

Because it runs in the background off the commit's env, **export `VOYAGE_API_KEY`
in the shell you commit from** for it to actually re-embed. Check `rebuild.log`
to see what happened. Run it by hand anytime with `sh rebuild.sh`, or do a
visible foreground rebuild with `npm run build`.

To uninstall: `git config --unset core.hooksPath`.

## Query

```bash
# human-readable (what the SDK56 agent runs)
node query.js "how is reanimated babel configured here" --k 8

# machine-readable
node query.js "expo-secure-store face id permission" --json

# smaller/larger snippets
node query.js "..." --snippet 400
```

Each hit shows a cosine score, the source path + heading (docs) or line range
(code), and a snippet. **Always open the cited file to verify** — retrieval is a
pointer, not proof, and the index can lag the working tree.

## Offline self-test (no key, no network)

Deterministic hashed "fake" embeddings let you exercise the full pipeline without
Voyage:

```bash
npm run build:fake                     # writes index.json with fake vectors
node query.js "reanimated worklets" --fake
npm run build:dry                      # just walk + chunk, print stats, write nothing
```

A fake-built index is tagged `"fake": true`; `query.js` auto-detects it and
embeds the query the same way, so ranking still works (shared-vocabulary cosine).
Don't ship a fake index as if it were real — rebuild with a key for production use.

## Files

| File | Role |
|---|---|
| `build-index.js` | Walk corpus → chunk → embed → write `index.json`. Incremental by default; flags: `--full`, `--dry-run`, `--fake`, `--out`. |
| `rebuild.sh` | Quiet, locked, logged incremental rebuild for the git hook (and manual use). |
| `../../../../.githooks/post-commit` | Fires `rebuild.sh` in the background after commits touching the corpus. |
| `query.js` | Embed a query → cosine top-k → print hits. Flags: `--k`, `--json`, `--fake`, `--snippet`, `--index`. |
| `lib/corpus.js` | Corpus definition, file walker, markdown/code chunkers. |
| `lib/voyage.js` | Voyage REST client (batching + retry) and the fake-embedding mode. |
| `lib/cosine.js` | Cosine similarity + top-k ranking. |
| `index.json` | Generated vector index (committed; temp `index.*.json` stay ignored). |

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `VOYAGE_API_KEY` | — | Required for real embeddings (build + query). |
| `VOYAGE_MODEL` | `voyage-4` | Embedding model. `voyage-code-3` for code-heavy corpora. |
| `RAG_FAKE_EMBEDDINGS` | — | Set to `1` to force offline fake mode (same as `--fake`). |

## How the agent uses it

`.claude/agents/SDK56.md` instructs the agent to run `query.js` first for
"how/where does X work here" questions, then open the cited files and verify
versions from disk before answering. If `index.json` is missing it falls back to
reading the three corpus docs directly and asks you to build the index.
