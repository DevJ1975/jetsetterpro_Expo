import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import {
  AnimatedCounter,
  Badge,
  Button,
  Card,
  SectionLabel,
  SuccessAnimation,
  palette,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { EXPENSE_CATEGORY_META } from '@/src/features/expenses/categoryMeta';
import {
  EXPENSE_PROVIDERS,
  type ExpenseProviderMeta,
  useExpenseConnections,
} from '@/src/features/expenses/connections';
import { formatDate, formatDateRange, formatMoney } from '@/src/core/format';
import { sumByCurrency } from '@/src/core/expenses';
import { Expense } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

// Submit Expenses — port of iOS ExpenseExportView + ExpenseConnectionsView:
// trip window card, MATCHING/SELECTED/TOTAL stat row with per-currency
// subtotals, a selectable expense checklist that feeds both the PDF export and
// provider submission, and the provider connection cards.

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

function buildHtml(expenses: Expense[], name: string): string {
  const rows = expenses
    .map(
      (e) =>
        `<tr><td>${e.date}</td><td>${esc(e.merchant)}</td><td>${EXPENSE_CATEGORY_META[e.category].label}</td><td class="r">${e.amount.toFixed(2)} ${e.currency}</td></tr>`,
    )
    .join('');
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  const totalLines = [...totals.entries()].map(([c, t]) => `${t.toFixed(2)} ${c}`).join(' · ');
  return `<html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial;color:#0A0C18;padding:32px}
    h1{font-size:22px;margin:0} .sub{color:#52587A;margin:4px 0 20px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{padding:8px 6px;border-bottom:1px solid #DDE0EE;text-align:left}
    th{color:#52587A;text-transform:uppercase;font-size:11px}
    .r{text-align:right} .total{margin-top:18px;font-size:15px;font-weight:700}
  </style></head><body>
    <h1>JetSetter Pro — Expense Report</h1>
    <div class="sub">${esc(name || 'Traveler')} · ${new Date().toDateString()} · ${expenses.length} item(s)</div>
    <table><thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="total">Total: ${totalLines}</div>
  </body></html>`;
}

/** Deterministic beta reference — hashed from the provider + selection set. */
function referenceNumber(providerId: string, ids: Iterable<string>): string {
  const s = `${providerId}|${[...ids].sort().join(',')}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return `EXP-${String(100000 + (h % 900000))}`;
}

export default function ExpenseExportScreen() {
  const trips = useTravel((s) => s.trips);
  const expenses = useTravel((s) => s.expenses);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const name = usePreferences((s) => s.name);
  const connections = useExpenseConnections((s) => s.status);
  const connect = useExpenseConnections((s) => s.connect);
  const disconnect = useExpenseConnections((s) => s.disconnect);

  const [busyPdf, setBusyPdf] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ title: string; subtitle: string; ref: string } | null>(
    null,
  );
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (submitTimer.current) clearTimeout(submitTimer.current);
    },
    [],
  );

  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);

  // Trip window = whole calendar days (ISO date strings compare lexically).
  const matching = useMemo(() => {
    const inWindow = trip
      ? expenses.filter((e) => e.date >= trip.startDate && e.date <= trip.endDate)
      : expenses;
    return [...inWindow].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, trip]);

  // Selection: everything matching starts selected; reloads keep the user's
  // choices, drop vanished ids, and auto-select newly matching expenses
  // (mirrors the iOS load() reconciliation).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const matchingIds = new Set(matching.map((e) => e.id));
    setSelectedIds((prev) => {
      const known = knownIdsRef.current;
      knownIdsRef.current = matchingIds;
      if (!known) return matchingIds;
      const next = new Set([...prev].filter((id) => matchingIds.has(id)));
      for (const id of matchingIds) if (!known.has(id)) next.add(id);
      return next;
    });
  }, [matching]);

  const selected = useMemo(
    () => matching.filter((e) => selectedIds.has(e.id)),
    [matching, selectedIds],
  );
  const subtotals = useMemo(() => sumByCurrency(selected), [selected]);
  const allSelected = matching.length > 0 && selectedIds.size === matching.length;

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(matching.map((e) => e.id)));

  const exportPdf = async () => {
    if (selected.length === 0 || busyPdf) return;
    setBusyPdf(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(selected, name) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Report ready', `Saved to ${uri}`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not generate the report.');
    } finally {
      setBusyPdf(false);
    }
  };

  const submitTo = (provider: ExpenseProviderMeta) => {
    if (busyProvider || selected.length === 0) return;
    const count = selected.length;
    const ref = referenceNumber(provider.id, selectedIds);
    setBusyProvider(provider.id);
    submitTimer.current = setTimeout(() => {
      setBusyProvider(null);
      setSuccess({
        title: `Submitted to ${provider.name}`,
        subtitle: `Report created for ${count} expense${count === 1 ? '' : 's'}`,
        ref,
      });
    }, 1500);
  };

  const confirmDisconnect = (provider: ExpenseProviderMeta) =>
    Alert.alert(`Disconnect ${provider.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => disconnect(provider.id) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
        <BackHeader overline="Expensify · Ramp · Brex · Divvy" title="Submit Expenses" />
        <PremiumGate feature="Submit Expenses">
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
            {/* Trip window */}
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="airplane" size={13} color={palette.bright} />
                <Text style={[type.overline, { color: palette.bright }]}>
                  {trip ? 'Trip' : 'All expenses'}
                </Text>
              </View>
              {trip ? (
                <>
                  <Text style={type.sub}>{trip.name}</Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>
                    {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
                  </Text>
                </>
              ) : (
                <Text style={type.bodyDim}>No active trip — showing all expenses</Text>
              )}
            </Card>

            {matching.length === 0 ? (
              <Card variant="glass">
                <EmptyState
                  icon="send"
                  title="No expenses to submit"
                  subtitle={
                    trip
                      ? 'Nothing logged inside this trip window yet. Log expenses first, then submit them.'
                      : 'Log expenses first, then export or submit them.'
                  }
                />
              </Card>
            ) : (
              <>
                {/* MATCHING / SELECTED / TOTAL */}
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Stat label="Matching" value={matching.length} />
                    <View style={{ width: 1, height: 34, backgroundColor: palette.line }} />
                    <Stat label="Selected" value={selectedIds.size} />
                    <View style={{ width: 1, height: 34, backgroundColor: palette.line }} />
                    <Stat label="Total" value={expenses.length} />
                  </View>
                  {/* Per-currency subtotals for the selected set */}
                  <Text style={[type.caption, { marginTop: spacing.md, textAlign: 'center' }]}>
                    {subtotals.length > 0
                      ? subtotals.map((s) => formatMoney(s.total, s.currency)).join('  ·  ')
                      : `${formatMoney(0, homeCurrency)} selected`}
                  </Text>
                </Card>

                {/* Checklist */}
                <Card>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <SectionLabel style={{ flex: 1, marginBottom: 0 }}>Expenses</SectionLabel>
                    <Pressable onPress={toggleAll} hitSlop={8}>
                      <Text style={{ color: palette.bright, fontSize: 12, fontWeight: '700' }}>
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </Text>
                    </Pressable>
                  </View>
                  {matching.map((e, i) => {
                    const on = selectedIds.has(e.id);
                    return (
                      <Pressable
                        key={e.id}
                        onPress={() => toggle(e.id)}
                        style={({ pressed }) => [
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.md,
                            paddingVertical: 12,
                          },
                          i < matching.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: palette.line,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Ionicons
                          name={on ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={on ? palette.accent : palette.faint}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={{ fontSize: 15, fontWeight: '600', color: palette.text }}
                            numberOfLines={1}
                          >
                            {e.merchant}
                          </Text>
                          <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                            {EXPENSE_CATEGORY_META[e.category].label} · {formatDate(e.date)}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontFamily: MONO,
                            fontSize: 14,
                            fontWeight: '600',
                            color: on ? palette.text : palette.faint,
                          }}
                        >
                          {formatMoney(e.amount, e.currency)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Card>

                {/* PDF export row */}
                <Button
                  title={
                    busyPdf
                      ? 'Preparing…'
                      : `Export PDF & Share${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`
                  }
                  size="lg"
                  onPress={() => void exportPdf()}
                  disabled={busyPdf || selectedIds.size === 0}
                  icon={<Ionicons name="document-text" size={18} color="#04101F" />}
                />

                {/* Providers */}
                <View>
                  <SectionLabel>Submit To</SectionLabel>
                  <View style={{ gap: spacing.md }}>
                    {EXPENSE_PROVIDERS.map((p) => {
                      const isConnected = connections[p.id] === 'connected';
                      const busy = busyProvider === p.id;
                      return (
                        <Card key={p.id} variant="glass">
                          <Pressable
                            onLongPress={isConnected ? () => confirmDisconnect(p) : undefined}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                          >
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                backgroundColor: p.tile,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text
                                style={{ color: p.letterColor, fontSize: 20, fontWeight: '800' }}
                              >
                                {p.letter}
                              </Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[type.sub, { fontSize: 15 }]}>{p.name}</Text>
                              <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                                {p.tagline}
                              </Text>
                            </View>
                            {isConnected ? (
                              <Badge tone="good" label="Connected" />
                            ) : (
                              <Button
                                title="Connect"
                                size="sm"
                                variant="secondary"
                                onPress={() => connect(p.id)}
                              />
                            )}
                          </Pressable>
                          {isConnected ? (
                            <Button
                              title={
                                busy
                                  ? 'Submitting…'
                                  : `Submit ${selectedIds.size} expense${selectedIds.size === 1 ? '' : 's'}`
                              }
                              size="sm"
                              onPress={() => submitTo(p)}
                              disabled={busy || busyProvider != null || selectedIds.size === 0}
                              icon={
                                busy ? (
                                  <ActivityIndicator size="small" color="#04101F" />
                                ) : (
                                  <Ionicons name="paper-plane" size={14} color="#04101F" />
                                )
                              }
                              style={{ marginTop: spacing.md }}
                            />
                          ) : null}
                        </Card>
                      );
                    })}
                  </View>
                  <Card variant="outline" style={{ marginTop: spacing.md }}>
                    <Text style={type.caption}>
                      Beta: connections are saved on this device only. Provider submission
                      activates for connected accounts after beta — until then, use the PDF export
                      to file reports.
                    </Text>
                  </Card>
                </View>
              </>
            )}
          </View>
        </PremiumGate>
      </Screen>

      {success ? (
        <SuccessAnimation
          title={success.title}
          subtitle={success.subtitle}
          referenceNumber={success.ref}
          onDismiss={() => setSuccess(null)}
        />
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text
        style={{
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 1.3,
          color: palette.dim,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <AnimatedCounter
        target={value}
        duration={0.6}
        format="integer"
        style={[type.stat, { fontSize: 22 }]}
      />
    </View>
  );
}
