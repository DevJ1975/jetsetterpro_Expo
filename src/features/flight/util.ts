// Small pure helpers shared by the flight screens (tracker, board, in-flight).

/** Airport-local HH:mm from an ISO string that carries the airport offset.
 *  String-sliced (not Date-parsed) so the airport-local wall time survives. */
export function hhmm(iso?: string | null): string {
  return iso && iso.length >= 16 ? iso.slice(11, 16) : '—';
}

/** "just now" / "3m ago" / "2h ago" for the LIVE bar. */
export function agoLabel(deltaMs: number): string {
  const s = Math.max(0, Math.floor(deltaMs / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** UTC offset (minutes, east-positive) parsed from an ISO-8601 suffix. */
export function parseOffsetMin(iso?: string | null): number | null {
  if (!iso) return null;
  if (iso.endsWith('Z')) return 0;
  const m = iso.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local wall-clock HH:mm for an epoch-ms instant. */
export function localHHmm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
