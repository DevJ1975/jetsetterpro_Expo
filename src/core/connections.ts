// Tight-connection assistant logic — estimate the gate-to-gate transfer time
// between an arriving flight and a departing flight and judge whether the
// layover is comfortable. There is no free intra-terminal walk-time API, so
// this is a transparent heuristic from terminal/concourse/gate; IRIS explains
// the estimate and never presents it as a guarantee. Pure + testable.

export interface GateRef {
  terminal?: string | null;
  gate?: string | null;
}

export interface ConnectionAssessment {
  /** Estimated minutes from wheels-down to boarding the next flight. */
  transferMinutes: number;
  layoverMinutes: number;
  /** Slack = layover − transfer estimate. */
  bufferMinutes: number;
  verdict: 'comfortable' | 'tight' | 'risky';
  sameTerminal: boolean | null;
  advice: string;
}

const DEPLANE_MIN = 10; // wheels-down → off the jet bridge
const BOARDING_LEAD_MIN = 15; // must be at the gate before doors close

/** Concourse token from a gate label ("B12" → "B", "T2-45" → "T"). */
function concourse(gate?: string | null): string | null {
  if (!gate) return null;
  const m = gate.trim().toUpperCase().match(/[A-Z]+/);
  return m ? m[0] : null;
}

function norm(s?: string | null): string | null {
  const v = (s ?? '').trim().toUpperCase();
  return v.length ? v : null;
}

/** Heuristic walking minutes between two gates (excludes deplaning/boarding). */
export function estimateGateWalk(from: GateRef, to: GateRef): number {
  const t1 = norm(from.terminal);
  const t2 = norm(to.terminal);
  if (t1 && t2 && t1 !== t2) return 22; // different terminal — often a train/shuttle
  const c1 = concourse(from.gate);
  const c2 = concourse(to.gate);
  if (t1 && t2 && t1 === t2) {
    if (c1 && c2 && c1 !== c2) return 12; // same terminal, different concourse
    return 6; // same terminal & concourse
  }
  if (c1 && c2) return c1 === c2 ? 6 : 12; // no terminals, infer from concourse
  return 15; // unknown — conservative
}

/**
 * Assess a connection from the arriving flight's landing time to the next
 * flight's departure. `from` is the arrival gate, `to` the departure gate.
 */
export function assessConnection(
  arrivalISO: string,
  departureISO: string,
  from: GateRef,
  to: GateRef,
): ConnectionAssessment {
  const arr = Date.parse(arrivalISO);
  const dep = Date.parse(departureISO);
  const layoverMinutes = Number.isNaN(arr) || Number.isNaN(dep) ? 0 : Math.round((dep - arr) / 60_000);
  const walk = estimateGateWalk(from, to);
  const transferMinutes = DEPLANE_MIN + walk + BOARDING_LEAD_MIN;
  const bufferMinutes = layoverMinutes - transferMinutes;

  const t1 = norm(from.terminal);
  const t2 = norm(to.terminal);
  const sameTerminal = t1 && t2 ? t1 === t2 : null;

  let verdict: ConnectionAssessment['verdict'];
  if (bufferMinutes >= 25) verdict = 'comfortable';
  else if (bufferMinutes >= 8) verdict = 'tight';
  else verdict = 'risky';

  const where =
    sameTerminal === false
      ? `You change terminals (${t1} → ${t2}), so allow time for the inter-terminal train or shuttle.`
      : from.gate && to.gate
        ? `Gate ${String(from.gate).toUpperCase()} → gate ${String(to.gate).toUpperCase()}.`
        : 'Gate details are limited, so this is a conservative estimate.';

  const verdictLine =
    verdict === 'comfortable'
      ? `You should make it comfortably — about ${bufferMinutes} min to spare after a ~${transferMinutes} min transfer.`
      : verdict === 'tight'
        ? `It's tight: ~${transferMinutes} min needed against a ${layoverMinutes} min layover (≈${bufferMinutes} min slack). Move with purpose and skip the lounge.`
        : `High risk — the ~${transferMinutes} min transfer barely fits (or exceeds) the ${layoverMinutes} min layover. Head straight to the gate, ask crew to deplane first, and alert the airline about the tight connection.`;

  return {
    transferMinutes,
    layoverMinutes,
    bufferMinutes,
    verdict,
    sameTerminal,
    advice: `${verdictLine} ${where}`,
  };
}
