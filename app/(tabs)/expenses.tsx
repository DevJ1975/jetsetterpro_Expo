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
import { CATEGORY_META, ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

export default function ExpensesScreen() {
  const router = useRouter();
  const expenses = useTravel((s) => s.expenses);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  const { total, byCategory } = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    let sum = 0;
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
      sum += e.amount;
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return { total: sum, byCategory: ranked };
  }, [expenses]);

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
            <Text style={type.display}>{formatMoney(total, homeCurrency)}</Text>
          </Card>

          <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <SectionLabel>By category</SectionLabel>
            {byCategory.map(([cat, amount]) => (
              <View key={cat} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type.body, { flex: 1 }]}>{CATEGORY_META[cat].label}</Text>
                  <Text style={type.body}>{formatMoney(amount, homeCurrency)}</Text>
                </View>
                <ProgressBar value={total > 0 ? amount / total : 0} />
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
