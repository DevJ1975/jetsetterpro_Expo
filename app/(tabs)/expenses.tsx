import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Card,
  ListRow,
  ProgressBar,
  ScreenHeader,
  SectionLabel,
  palette,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate, formatMoney } from '@/src/core/format';
import { formatByCurrency, sumByCurrency } from '@/src/core/expenses';
import { CATEGORY_META, ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

export default function ExpensesScreen() {
  const router = useRouter();
  const expenses = useTravel((s) => s.expenses);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  const { totalLabel, byCategory, categoryCurrency, categoryTotal } = useMemo(() => {
    // The header shows every currency; the category breakdown is scoped to the
    // dominant currency so its amounts and bar ratios are meaningful (summing
    // categories across currencies would be nonsense).
    const primary = sumByCurrency(expenses)[0]?.currency ?? homeCurrency;
    const totals = new Map<ExpenseCategory, number>();
    let primaryTotal = 0;
    for (const e of expenses) {
      if (e.currency !== primary) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
      primaryTotal += e.amount;
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return {
      totalLabel: formatByCurrency(expenses, homeCurrency),
      byCategory: ranked,
      categoryCurrency: primary,
      categoryTotal: primaryTotal,
    };
  }, [expenses, homeCurrency]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader
        overline={`${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`}
        title="Expenses"
        right={
          <Pressable onPress={() => router.push('/add-expense')} hitSlop={12}>
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
            subtitle="Log your trip spend to see totals and a category breakdown."
            actionLabel="Add an expense"
            onAction={() => router.push('/add-expense')}
          />
        </Card>
      ) : (
        <>
          <Card variant="glass">
            <SectionLabel>Total spend</SectionLabel>
            <Text style={type.display}>{totalLabel}</Text>
          </Card>

          <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <SectionLabel>By category</SectionLabel>
            {byCategory.map(([cat, amount]) => (
              <View key={cat} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type.body, { flex: 1 }]}>{CATEGORY_META[cat].label}</Text>
                  <Text style={type.body}>{formatMoney(amount, categoryCurrency)}</Text>
                </View>
                <ProgressBar value={categoryTotal > 0 ? amount / categoryTotal : 0} />
              </View>
            ))}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>Recent</SectionLabel>
            {expenses.map((e, i) => (
              <ListRow
                key={e.id}
                last={i === expenses.length - 1}
                icon={<IconWell name={CATEGORY_META[e.category].icon} size={18} />}
                title={e.merchant}
                subtitle={`${CATEGORY_META[e.category].label} · ${formatDate(e.date)}`}
                right={<Text style={type.sub}>{formatMoney(e.amount, e.currency)}</Text>}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
