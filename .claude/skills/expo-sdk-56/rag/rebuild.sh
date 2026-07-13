#!/bin/sh
# Incrementally refresh the SDK56 RAG index. Safe to run anytime — used by the
# post-commit hook (.githooks/post-commit) and runnable by hand. Never throws in
# your face: missing node or key just logs a note and exits 0.
#
# Manual foreground rebuild with visible output is `npm run build`. This script
# is the quiet, locked, logged variant for the hook.

DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
LOG="$DIR/rebuild.log"
LOCK="$DIR/.rebuild.lock"

# Clear a stale lock (a crashed prior run) older than 30 minutes.
find "$LOCK" -maxdepth 0 -mmin +30 -exec rmdir {} \; 2>/dev/null

# Atomic lock via mkdir: bail if a rebuild is already running.
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date): skipped — rebuild already in progress" >>"$LOG"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM

{
  echo "=== $(date): rebuild triggered ==="
  if ! command -v node >/dev/null 2>&1; then
    echo "node not found on PATH — skipping. Index left unchanged."
    exit 0
  fi
  if [ -z "$VOYAGE_API_KEY" ] && [ "$RAG_FAKE_EMBEDDINGS" != "1" ]; then
    echo "VOYAGE_API_KEY not set — skipping. Set it (or RAG_FAKE_EMBEDDINGS=1 for offline). Index left unchanged."
    exit 0
  fi
  cd "$DIR" || exit 0
  node build-index.js
  echo "=== $(date): rebuild done ==="
} >>"$LOG" 2>&1

exit 0
