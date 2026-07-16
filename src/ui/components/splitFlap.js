// Pure split-flap stepping logic (shared by SplitFlapText + unit tests).
// Mirrors iOS SplitFlapCharacter: cells cycle forward through a fixed
// alphabet, wrapping, until they land on the target character.
export const FLAP_ALPHABET = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :-+./');

/** Uppercase + coerce into the flap alphabet ('?' → ' '). */
export function normalizeFlapChar(char) {
  const upper = (char ?? ' ').toUpperCase();
  return FLAP_ALPHABET.includes(upper) ? upper : ' ';
}

/** One flap forward from `current` toward `target` (already normalized). */
export function nextFlapChar(current) {
  const idx = FLAP_ALPHABET.indexOf(current);
  return FLAP_ALPHABET[(idx < 0 ? 0 : idx + 1) % FLAP_ALPHABET.length];
}

/** Number of forward flaps to reach `target` from `current` (0 = already there). */
export function flapDistance(current, target) {
  const from = FLAP_ALPHABET.indexOf(normalizeFlapChar(current));
  const to = FLAP_ALPHABET.indexOf(normalizeFlapChar(target));
  if (from < 0 || to < 0) return 0;
  return (to - from + FLAP_ALPHABET.length) % FLAP_ALPHABET.length;
}
