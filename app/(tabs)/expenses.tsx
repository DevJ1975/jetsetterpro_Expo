import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { AnimatedCounter, Card, ScreenHeader, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { CategoryBarChart, type CategoryAmount } from '@/src/features/expenses/CategoryBarChart';
import { ExpenseRow } from '@/src/features/expenses/ExpenseRow';
import { formatMoney } from '@/src/core/format';
import { sumByCurrency } from '@/src/core/expenses';
import { isReceiptScanAvailable, scanReceipt } from '@/src/core/services/receiptScan';
import type { ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

// Expense tracker tab — port of iOS ExpenseTrackerView: "Total Spent" summary,
// the Swift Charts "Spending by Category" horizontal bars, a swipe-to-delete
// expense list, and the toolbar "+" menu (Scan Receipt / From Photos / Log
// Mileage / Add Manually).

// ML Kit is a native module — absent in Expo Go/web, so the scan menu entries
// hide themselves there (iOS hides the camera button on simulators the same way).
const SCAN_AVAILABLE = isReceiptScanAvailable();

export default function ExpensesScreen() {
  const router = useRouter();
  const expenses = useTravel((s) => s.expenses);
  const removeExpense = useTravel((s) => s.removeExpense);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  const { homeTotal, otherTotals, byCategory, chartCurrency, sorted } = useMemo(() => {
    const buckets = sumByCurrency(expenses);
    const home = buckets.find((b) => b.currency === homeCurrency);
    // Category amounts share one axis, so the chart scopes to a single
    // currency: the home bucket when it has spend, else the dominant one.
    const chartCur = home && home.total > 0 ? homeCurrency : (buckets[0]?.currency ?? homeCurrency);
    const totals = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      if (e.currency !== chartCur) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
    const ranked: CategoryAmount[] = [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      homeTotal: home?.total ?? 0,
      otherTotals: buckets.filter((b) => b.currency !== homeCurrency),
      byCategory: ranked,
      chartCurrency: chartCur,
      sorted: [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [expenses, homeCurrency]);

  const pushScanResult = async (source: 'camera' | 'library') => {
    const parsed = await scanReceipt(source);
    if (!parsed) return; // cancelled, unavailable, or OCR failed
    router.push({
      pathname: '/add-expense',
      params: {
        scanned: '1',
        ...(parsed.amount != null ? { amount: String(parsed.amount) } : {}),
        ...(parsed.currency ? { currency: parsed.currency } : {}),
        ...(parsed.merchant ? { merchant: parsed.merchant } : {}),
        ...(parsed.date ? { date: parsed.date } : {}),
      },
    });
  };

  // iOS toolbar Menu — RN analog is a small action sheet via Alert buttons.
  const openAddMenu = () => {
    Alert.alert('Add Expense', undefined, [
      ...(SCAN_AVAILABLE
        ? [
            { text: 'Scan Receipt', onPress: () => void pushScanResult('camera') },
            { text: 'From Photos', onPress: () => void pushScanResult('library') },
          ]
        : []),
      {
        text: 'Log Mileage',
        onPress: () => router.push({ pathname: '/add-expense', params: { mode: 'mileage' } }),
      },
      { text: 'Add Manually', onPress: () => router.push('/add-expense') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmDelete = (id: string, merchant: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete expense?', merchant, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExpense(id) },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader
        overline={`${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`}
        title="Expenses"
        right={
          <Pressable onPress={openAddMenu} hitSlop={12} accessibilityLabel="Add expense">
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
        style={{ paddingHorizontal: 0 }}
      />

      {expenses.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="stats-chart"
            title="No expenses yet"
            subtitle="Tap + to scan a receipt, log mileage, or add an expense manually."
            actionLabel="Add an expense"
            onAction={openAddMenu}
          />
        </Card>
      ) : (
        <>
          <Card variant="glass">
            <SectionLabel>Total Spent</SectionLabel>
            <AnimatedCounter
              target={homeTotal}
              duration={0.8}
              format={{ currency: homeCurrency }}
              style={[type.display, { fontSize: 30, lineHeight: 38 }]}
            />
            {otherTotals.length > 0 ? (
              <Text style={[type.caption, { marginTop: 4 }]}>
                + {otherTotals.map((b) => formatMoney(b.total, b.currency)).join(' · ')}
              </Text>
            ) : null}
          </Card>

          {byCategory.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionLabel>Spending by Category</SectionLabel>
              <CategoryBarChart data={byCategory} currency={chartCurrency} />
            </Card>
          ) : null}

          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>Recent</SectionLabel>
            {sorted.map((e, i) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                last={i === sorted.length - 1}
                onDelete={() => confirmDelete(e.id, e.merchant)}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
