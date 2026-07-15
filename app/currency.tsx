import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AnimatedCounter,
  Card,
  Input,
  ProgressBar,
  SectionLabel,
  palette,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { useTripBudgets } from '@/src/features/expenses/budget';
import { CategoryDonut } from '@/src/features/expenses/CategoryDonut';
import { EXPENSE_CATEGORY_META } from '@/src/features/expenses/categoryMeta';
import { destinationCurrencyFor } from '@/src/features/expenses/destinationCurrency';
import { ExpenseRow } from '@/src/features/expenses/ExpenseRow';
import { convertCurrency } from '@/src/core/api/exchange';
import { formatMoney } from '@/src/core/format';
import { useNow } from '@/src/core/useNow';
import type { ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

// Currency & Expenses — port of iOS CurrencyExpenseView: converter card with a
// stale-rate age line, per-trip budget with progress, the "Spend by Category"
// donut in the destination currency (≈ home conversions per legend row), and
// the recent expense list. Budget + donut are Pro (iOS gates the whole screen;
// the converter stays free here, as before).

function ageLabel(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'under 1m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export default function CurrencyScreen() {
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const trips = useTravel((s) => s.trips);
  const expenses = useTravel((s) => s.expenses);

  // ── Trip scoping ───────────────────────────────────────────────────────────
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);
  const destCurrency = useMemo(
    () => (trip ? destinationCurrencyFor(trip.destination) : null),
    [trip],
  );

  const tripExpenses = useMemo(() => {
    const scoped = trip
      ? expenses.filter((e) => e.date >= trip.startDate && e.date <= trip.endDate)
      : expenses;
    return [...scoped].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, trip]);

  // ── Converter ─────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState(homeCurrency || 'USD');
  // "To" follows the trip's destination currency until the user types their
  // own code (derived, so a trip change re-points it without a sync effect).
  const [toOverride, setToOverride] = useState<string | null>(null);
  const to = toOverride ?? destCurrency ?? 'JPY';
  const setTo = (v: string) => setToOverride(v);
  const [result, setResult] = useState<{ converted: number; rate: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ratesAt, setRatesAt] = useState<number | null>(null);
  const now = useNow(60_000); // keeps the age line ticking

  const convert = async () => {
    const n = parseFloat(amount);
    if (isNaN(n)) return;
    setStatus('loading');
    const r = await convertCurrency(n, from, to);
    if (r) {
      setResult(r);
      setRatesAt(Date.now());
      setStatus('idle');
    } else {
      setResult(null);
      setStatus('error');
    }
  };

  const swap = () => {
    setFrom(to);
    setToOverride(from);
    setResult(null);
  };

  // Editing any input invalidates the previous result — clear it so the panel
  // never shows a stale amount relabeled with a newly-typed currency code.
  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setResult(null);
    setStatus('idle');
  };

  // ── Analytics rates (home-based) ──────────────────────────────────────────
  // One home-based rate per involved currency covers both directions:
  // amount/rate → home, home×rate(display) → destination.
  const displayCurrency = (destCurrency ?? homeCurrency).toUpperCase();
  const neededKey = useMemo(() => {
    const set = new Set<string>();
    for (const e of tripExpenses) set.add(e.currency.toUpperCase());
    set.add(displayCurrency);
    set.delete(homeCurrency.toUpperCase());
    return [...set].sort().join(',');
  }, [tripExpenses, displayCurrency, homeCurrency]);

  const [homeRates, setHomeRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const codes = neededKey ? neededKey.split(',') : [];
    (async () => {
      const out: Record<string, number> = {};
      for (const c of codes) {
        const r = await convertCurrency(1, homeCurrency, c);
        if (r) out[c] = r.rate;
      }
      if (!cancelled) setHomeRates(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [neededKey, homeCurrency]);

  const analytics = useMemo(() => {
    const home = homeCurrency.toUpperCase();
    const rateOf = (code: string): number | null => {
      const c = code.toUpperCase();
      if (c === home) return 1;
      const r = homeRates?.[c];
      return r && r > 0 ? r : null;
    };
    const displayRate = rateOf(displayCurrency);
    let spentHome = 0;
    let skipped = 0;
    const byCat = new Map<ExpenseCategory, number>(); // totals in home currency
    const rowConverted = new Map<string, string>(); // "≈ $12.00" per expense id
    for (const e of tripExpenses) {
      const r = rateOf(e.currency);
      if (r == null) {
        skipped += 1;
        continue;
      }
      const inHome = e.amount / r;
      spentHome += inHome;
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + inHome);
      if (e.currency.toUpperCase() !== home) {
        rowConverted.set(e.id, `≈ ${formatMoney(inHome, home)}`);
      }
    }
    const segments = [...byCat.entries()]
      .map(([category, homeAmount]) => ({
        category,
        homeAmount,
        displayAmount: displayRate != null ? homeAmount * displayRate : homeAmount,
      }))
      .sort((a, b) => b.displayAmount - a.displayAmount);
    // If the destination rate hasn't loaded, fall back to home-currency labels
    // rather than mislabeling home amounts with the destination code.
    const donutCurrency = displayRate != null ? displayCurrency : home;
    const totalDisplay = displayRate != null ? spentHome * displayRate : spentHome;
    return { spentHome, skipped, segments, totalDisplay, donutCurrency, rowConverted };
  }, [tripExpenses, homeRates, homeCurrency, displayCurrency]);

  // ── Budget (per trip) ─────────────────────────────────────────────────────
  const budget = useTripBudgets((s) => (trip ? s.budgets[trip.id] : undefined));
  const setBudget = useTripBudgets((s) => s.setBudget);
  // While editing, show the draft text; otherwise mirror the store (so
  // hydration/external changes appear without a sync effect fighting typing).
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const budgetText = budgetDraft ?? (budget != null ? String(budget) : '');

  const onBudgetChange = (v: string) => {
    setBudgetDraft(v);
    if (!trip) return;
    const n = parseFloat(v);
    setBudget(trip.id, !isNaN(n) && n > 0 ? n : undefined);
  };

  const overBudget = budget != null && analytics.spentHome > budget;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={trip ? `Trip · ${trip.name}` : 'Live rates'}
        title={trip ? trip.destination : 'Currency & Expenses'}
      />

      {/* ── Converter (free) ── */}
      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Converter</SectionLabel>
        <Input label="Amount" value={amount} onChangeText={edit(setAmount)} keyboardType="decimal-pad" />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
          <Input label="From" value={from} onChangeText={edit(setFrom)} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
          <Pressable onPress={swap} hitSlop={10} style={{ paddingBottom: 12 }} accessibilityLabel="Swap currencies">
            <Ionicons name="swap-horizontal" size={24} color={palette.bright} />
          </Pressable>
          <Input label="To" value={to} onChangeText={edit(setTo)} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
        </View>

        <Pressable
          onPress={() => void convert()}
          disabled={status === 'loading'}
          style={{
            height: 44,
            borderRadius: 14,
            backgroundColor: palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          <Text style={[type.body, { color: '#04101F', fontWeight: '700' }]}>
            {status === 'loading' ? 'Converting…' : 'Convert'}
          </Text>
        </Pressable>

        {result ? (
          <View>
            <Text style={type.stat}>{formatMoney(result.converted, to.toUpperCase())}</Text>
            <Text style={[type.caption, { marginTop: 2 }]}>
              1 {from.toUpperCase()} = {result.rate.toFixed(4)} {to.toUpperCase()}
            </Text>
            {ratesAt != null ? (
              <Pressable
                onPress={() => void convert()}
                disabled={status === 'loading'}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}
              >
                <Ionicons name="time-outline" size={12} color={palette.faint} />
                <Text style={[type.caption, { color: palette.faint }]}>
                  Rates {ageLabel(Math.max(0, now - ratesAt))} old ·{' '}
                  <Text style={{ color: palette.bright }}>refresh</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : status === 'error' ? (
          <Pressable onPress={() => void convert()} hitSlop={6}>
            <Text style={[type.caption, { color: palette.bad }]}>
              Couldn&apos;t fetch a rate — check the currency codes ·{' '}
              <Text style={{ color: palette.bright }}>retry</Text>
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {/* ── Budget + donut (Pro) ── */}
      {trip ? (
        <PremiumGate feature="Trip budget & analytics">
          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>Trip Budget</SectionLabel>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <AnimatedCounter
                  target={analytics.spentHome}
                  duration={0.8}
                  format={{ currency: homeCurrency }}
                  style={[type.stat, overBudget && { color: palette.bad }]}
                />
                <Text style={[type.caption, { marginTop: 2 }]}>total spent</Text>
              </View>
              <Input
                label={`Budget (${homeCurrency})`}
                placeholder="0"
                value={budgetText}
                onChangeText={onBudgetChange}
                onFocus={() => setBudgetDraft(budgetText)}
                onBlur={() => setBudgetDraft(null)}
                keyboardType="decimal-pad"
                style={{ width: 140 }}
              />
            </View>

            {budget != null ? (
              <View style={{ marginTop: spacing.md, gap: 6 }}>
                {overBudget ? (
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,92,92,0.25)',
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ width: '100%', height: 6, backgroundColor: palette.bad }} />
                  </View>
                ) : (
                  <ProgressBar value={budget > 0 ? analytics.spentHome / budget : 0} />
                )}
                <Text style={[type.caption, overBudget && { color: palette.bad }]}>
                  {overBudget
                    ? `Over budget by ${formatMoney(analytics.spentHome - budget, homeCurrency)}`
                    : `${formatMoney(Math.max(0, budget - analytics.spentHome), homeCurrency)} remaining`}
                </Text>
              </View>
            ) : (
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Set a budget to track this trip&apos;s spend.
              </Text>
            )}
            {analytics.skipped > 0 ? (
              <Text style={[type.caption, { marginTop: 4, color: palette.faint }]}>
                Excludes {analytics.skipped} expense{analytics.skipped === 1 ? '' : 's'} awaiting
                exchange rates.
              </Text>
            ) : null}
          </Card>

          {analytics.segments.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionLabel>Spend by Category</SectionLabel>
              <CategoryDonut
                segments={analytics.segments.map((s) => ({
                  color: EXPENSE_CATEGORY_META[s.category].color,
                  value: s.displayAmount,
                }))}
                size={180}
                strokeWidth={8}
              >
                <Text style={[type.stat, { fontSize: 17 }]} numberOfLines={1}>
                  {formatMoney(analytics.totalDisplay, analytics.donutCurrency)}
                </Text>
                <Text style={type.caption}>total</Text>
              </CategoryDonut>

              <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                {analytics.segments.map((s) => {
                  const meta = EXPENSE_CATEGORY_META[s.category];
                  return (
                    <View
                      key={s.category}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          backgroundColor: meta.color,
                        }}
                      />
                      <Text style={[type.body, { flex: 1 }]}>{meta.label}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={type.body}>
                          {formatMoney(s.displayAmount, analytics.donutCurrency)}
                        </Text>
                        {analytics.donutCurrency !== homeCurrency.toUpperCase() ? (
                          <Text style={type.caption}>
                            ≈ {formatMoney(s.homeAmount, homeCurrency)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : tripExpenses.length > 0 && homeRates == null ? (
            <Card variant="outline" style={{ marginTop: spacing.lg }}>
              <Text style={type.caption}>Fetching live rates for the category breakdown…</Text>
            </Card>
          ) : null}
        </PremiumGate>
      ) : (
        <Card variant="outline" style={{ marginTop: spacing.lg }}>
          <Text style={type.bodyDim}>
            No active trip — create one in Itinerary to unlock the trip budget and category
            analytics.
          </Text>
        </Card>
      )}

      {/* ── Recent expenses ── */}
      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Recent Expenses</SectionLabel>
        {tripExpenses.length === 0 ? (
          <Text style={type.bodyDim}>
            {trip ? 'No expenses logged for this trip yet.' : 'No expenses logged yet.'}
          </Text>
        ) : (
          tripExpenses.map((e, i) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              last={i === tripExpenses.length - 1}
              convertedLabel={analytics.rowConverted.get(e.id)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
