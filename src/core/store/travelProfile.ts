import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { makeId } from '@/src/core/format';
import { usePreferences } from '@/src/core/store/preferences';

// Port of the iOS learning layer (Core/Services/Learning/TravelSignal.swift +
// TravelProfile.swift), simplified: a consent-gated log of behavioral signals
// plus a pure deriveProfile() that turns them into the human-readable rows
// shown in "What IRIS Has Learned". On-device only — never shared; wiped by
// "Reset all learning" and per-row "Forget this".

// ── Signals ──────────────────────────────────────────────────────────────────

/** Raw values are persisted — don't rename (mirrors iOS TravelSignal.Kind). */
export type SignalKind =
  | 'airlineFlown' // value: airline name/code
  | 'seatPicked' // value: a seat ("14A") or a column ("window")
  | 'airportUsed' // value: IATA code
  | 'tripLength' // value: whole days, as a string
  | 'expenseCategory' // value: expense category label
  | 'currencySet' // value: ISO currency code
  | 'contactAdded'; // value: relationship ("Partner", "Family", …)

export interface TravelSignal {
  id: string;
  kind: SignalKind;
  value: string;
  at: string; // ISO timestamp
}

// ── Derived profile (pure) ───────────────────────────────────────────────────

export type DerivedKey =
  | 'preferredAirline'
  | 'usualSeat'
  | 'homeAirport'
  | 'typicalTripLength'
  | 'spendingPattern';

export interface DerivedPref {
  key: DerivedKey;
  label: string;
  value: string;
  detail: string;
  /** 1–3 confidence dots (observation-count based, capped like the iOS gates). */
  confidence: 1 | 2 | 3;
  /** The signal kinds behind this row — "Forget this" deletes exactly these. */
  kinds: SignalKind[];
}

function dots(count: number): 1 | 2 | 3 {
  return count >= 3 ? 3 : count === 2 ? 2 : 1;
}

function mode(values: string[]): { value: string; count: number } | null {
  if (values.length === 0) return null;
  const tally = new Map<string, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of tally) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

/** Seat column for typical layouts — A/F/K/L window, C/D/G/H aisle, B/E middle
 *  (iOS TravelProfileEngine.seatColumn). Accepts a bare column name too. */
export function seatColumn(raw: string): 'window' | 'aisle' | 'middle' | null {
  const v = raw.trim().toLowerCase();
  if (v === 'window' || v === 'aisle' || v === 'middle') return v;
  const letter = /^\d{1,3}([a-z])$/.exec(v)?.[1]?.toUpperCase();
  if (!letter) return null;
  if ('AFKL'.includes(letter)) return 'window';
  if ('CDGH'.includes(letter)) return 'aisle';
  if ('BE'.includes(letter)) return 'middle';
  return null;
}

const cap = (s: string) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));
const times = (n: number) => `${n}×`;

/** Pure derivation of the learned profile from the raw signal log. */
export function deriveProfile(signals: TravelSignal[]): DerivedPref[] {
  const byKind = (kind: SignalKind) => signals.filter((s) => s.kind === kind);
  const rows: DerivedPref[] = [];

  const airline = mode(byKind('airlineFlown').map((s) => s.value));
  if (airline) {
    rows.push({
      key: 'preferredAirline',
      label: 'Preferred airline',
      value: airline.value,
      detail: `Flown ${times(airline.count)}`,
      confidence: dots(airline.count),
      kinds: ['airlineFlown'],
    });
  }

  const seatPicks = byKind('seatPicked')
    .map((s) => seatColumn(s.value))
    .filter((c): c is 'window' | 'aisle' | 'middle' => c != null);
  const seat = mode(seatPicks);
  if (seat) {
    rows.push({
      key: 'usualSeat',
      label: 'Usual seat',
      value: `${cap(seat.value)} seat`,
      detail: `${seat.count} of ${seatPicks.length} picks`,
      confidence: dots(seat.count),
      kinds: ['seatPicked'],
    });
  }

  const airport = mode(byKind('airportUsed').map((s) => s.value.toUpperCase()));
  if (airport) {
    rows.push({
      key: 'homeAirport',
      label: 'Home airport',
      value: airport.value,
      detail: `Seen ${times(airport.count)}`,
      confidence: dots(airport.count),
      kinds: ['airportUsed'],
    });
  }

  const lengths = byKind('tripLength')
    .map((s) => Number.parseInt(s.value, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (lengths.length > 0) {
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    rows.push({
      key: 'typicalTripLength',
      label: 'Typical trip length',
      value: `~${avg} day${avg === 1 ? '' : 's'}`,
      detail: `From ${lengths.length} trip${lengths.length === 1 ? '' : 's'}`,
      confidence: dots(lengths.length),
      kinds: ['tripLength'],
    });
  }

  // Spending pattern: prefer logged categories; fall back to the currency the
  // traveler works in (recorded from Settings), so the row lights up early.
  const category = mode(byKind('expenseCategory').map((s) => s.value));
  const currency = mode(byKind('currencySet').map((s) => s.value.toUpperCase()));
  if (category) {
    rows.push({
      key: 'spendingPattern',
      label: 'Spending pattern',
      value: `Mostly ${category.value.toLowerCase()}`,
      detail: `${category.count} expense${category.count === 1 ? '' : 's'}`,
      confidence: dots(category.count),
      kinds: ['expenseCategory', 'currencySet'],
    });
  } else if (currency) {
    rows.push({
      key: 'spendingPattern',
      label: 'Spending pattern',
      value: `Spends in ${currency.value}`,
      detail: `Set ${times(currency.count)}`,
      confidence: dots(currency.count),
      kinds: ['expenseCategory', 'currencySet'],
    });
  }

  return rows;
}

// ── Store ────────────────────────────────────────────────────────────────────

const MAX_SIGNALS = 400;

interface TravelProfileState {
  signals: TravelSignal[];
  _hasHydrated: boolean;
  /** Append one observation. No-op without learning consent (master switch). */
  record: (kind: SignalKind, value: string) => void;
  /** Per-row "Forget this": drop every signal of the given kinds. */
  forgetKinds: (kinds: SignalKind[]) => void;
  /** "Reset all learning" — wipe the whole signal log. */
  resetAll: () => void;
}

export const useTravelProfile = create<TravelProfileState>()(
  persist(
    (set, get) => ({
      signals: [],
      _hasHydrated: false,
      record: (kind, value) => {
        const v = value.trim();
        if (!v) return;
        // Consent gate — signals are recorded only while learning is on.
        if (!usePreferences.getState().irisLearning.master) return;
        const next = [...get().signals, { id: makeId(), kind, value: v, at: new Date().toISOString() }];
        set({ signals: next.length > MAX_SIGNALS ? next.slice(next.length - MAX_SIGNALS) : next });
      },
      forgetKinds: (kinds) =>
        set({ signals: get().signals.filter((s) => !kinds.includes(s.kind)) }),
      resetAll: () => set({ signals: [] }),
    }),
    {
      name: 'jetsetter_travel_profile',
      storage: zustandStorage,
      partialize: (s) => ({ signals: s.signals }),
      onRehydrateStorage: () => () => {
        useTravelProfile.setState({ _hasHydrated: true });
      },
    },
  ),
);

/** Convenience for non-React call sites (event handlers, other stores). */
export function recordSignal(kind: SignalKind, value: string): void {
  useTravelProfile.getState().record(kind, value);
}
