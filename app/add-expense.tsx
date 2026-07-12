import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId, toISODate } from '@/src/core/format';
import { CATEGORY_META, EXPENSE_CATEGORIES, ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

export default function AddExpenseScreen() {
  const router = useRouter();
  const addExpense = useTravel((s) => s.addExpense);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(homeCurrency || 'USD');
  const [category, setCategory] = useState<ExpenseCategory>('FOOD');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(toISODate());
  const [notes, setNotes] = useState('');

  const amountNum = parseFloat(amount);
  const valid = !isNaN(amountNum) && amountNum > 0 && merchant.trim().length > 0;

  const save = () => {
    if (!valid) return;
    addExpense({
      id: makeId(),
      amount: Math.round(amountNum * 100) / 100,
      currency: (currency.trim().toUpperCase() || 'USD').slice(0, 3),
      category,
      merchant: merchant.trim(),
      date,
      notes: notes.trim() || undefined,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Expense" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
            autoFocus
          />
          <Input
            label="Currency"
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={3}
            style={{ width: 120 }}
          />
        </View>
        <Input label="Merchant" placeholder="Tatte Bakery" value={merchant} onChangeText={setMerchant} />
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Category</Text>
          <Chips
            options={EXPENSE_CATEGORIES}
            value={category}
            onChange={setCategory}
            labelOf={(c) => CATEGORY_META[c].label}
          />
        </View>
        <Input label="Date" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} />
      </Card>
    </Screen>
  );
}
