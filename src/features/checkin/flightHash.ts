// Deterministic pseudo-randomness seeded from a flight ident, so seat maps,
// gates, and boarding groups look organic but are stable across renders and
// app launches (react-compiler forbids Math.random()/Date.now() in render).

/** FNV-1a 32-bit hash — tiny, stable string → uint32 seed. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — returns a () => [0,1) sequence for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded PRNG for a flight ident (+ optional salt for independent streams). */
export function rngFor(ident: string, salt = ''): () => number {
  return mulberry32(fnv1a(`${ident.toUpperCase()}|${salt}`));
}

/** Deterministic gate like "B14" for demo data. */
export function deterministicGate(ident: string): string {
  const r = rngFor(ident, 'gate');
  const letter = 'ABCD'[Math.floor(r() * 4)];
  return `${letter}${1 + Math.floor(r() * 28)}`;
}

/** Deterministic boarding group A–F. */
export function deterministicGroup(ident: string): string {
  return 'ABCDEF'[Math.floor(rngFor(ident, 'group')() * 6)];
}

/** Deterministic 6-char record locator (PNR-style, demo only). */
export function deterministicPNR(ident: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I lookalikes
  const r = rngFor(ident, 'pnr');
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(r() * alphabet.length)];
  return out;
}

export const SEAT_ROWS: number[] = Array.from({ length: 32 - 8 + 1 }, (_, i) => 8 + i);
export const SEAT_COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
/** Rows rendered with extra spacing (exit rows). */
export const EXIT_ROWS = [14, 21];

/** ~35% of the cabin is already taken — deterministic per flight ident. */
export function takenSeats(ident: string, ratio = 0.35): Set<string> {
  const r = rngFor(ident, 'seats');
  const taken = new Set<string>();
  for (const row of SEAT_ROWS) {
    for (const col of SEAT_COLS) {
      if (r() < ratio) taken.add(`${row}${col}`);
    }
  }
  return taken;
}

/** Deterministic open seat for pass previews when none was chosen yet. */
export function deterministicSeat(ident: string): string {
  const taken = takenSeats(ident);
  const r = rngFor(ident, 'fallback-seat');
  for (let i = 0; i < 64; i++) {
    const row = SEAT_ROWS[Math.floor(r() * SEAT_ROWS.length)];
    const col = SEAT_COLS[Math.floor(r() * SEAT_COLS.length)];
    const seat = `${row}${col}`;
    if (!taken.has(seat)) return seat;
  }
  return '12A';
}
