// Best-effort per-user rate limiting (in-memory, per instance). Good enough
// for beta abuse-damping; a Firestore-backed limiter is the hard-guarantee
// follow-up.

/** @returns {(uid: string, now?: number) => boolean} true when rate-limited */
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (uid, now = Date.now()) => {
    const recent = (hits.get(uid) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(uid, recent);
      return true;
    }
    recent.push(now);
    hits.set(uid, recent);
    return false;
  };
}

module.exports = { makeLimiter };
