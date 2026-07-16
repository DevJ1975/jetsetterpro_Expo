import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { useSaveCelebration } from '@/src/features/common/SaveCelebration';
import { Chips } from '@/src/features/common/Chips';
import { EXPENSE_CATEGORY_META } from '@/src/features/expenses/categoryMeta';
import { suggestCategory } from '@/src/features/expenses/suggestCategory';
import { formatMoney, makeId, toISODate } from '@/src/core/format';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

// Add Expense modal — extends the manual form with receipt-scan prefill
// (ExpenseTracker "+" menu passes OCR fields as route params) and the iOS
// LogMileageView flow (mode=mileage): FROM/TO + distance auto-priced at the
// IRS standard rate into a TRANSPORT expense.

/** US IRS standard mileage reimbursement rate for 2026, USD per mile. */
const IRS_MILEAGE_RATE_2026 = 0.7;

type Prefill = {
  mode?: string;
  scanned?: string;
  amount?: string;
  currency?: string;
  merchant?: string;
  date?: string;
};

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<Prefill>();
  if (params.mode === 'mileage') return <MileageForm />;
  return <ManualForm prefill={params} />;
}

// ── Manual entry (with scan prefill + category suggestion) ──────────────────

function ManualForm({ prefill }: { prefill: Prefill }) {
  const router = useRouter();
  const addExpense = useTravel((s) => s.addExpense);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const { celebrate, overlay } = useSaveCelebration();

  const scanned = prefill.scanned === '1';
  const [amount, setAmount] = useState(prefill.amount ?? '');
  const [currency, setCurrency] = useState(
    (prefill.currency ?? homeCurrency ?? 'USD').toUpperCase(),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    () => (prefill.merchant ? suggestCategory(prefill.merchant) : null) ?? 'FOOD',
  );
  const [merchant, setMerchant] = useState(prefill.merchant ?? '');
  const [date, setDate] = useState(prefill.date ?? toISODate());
  const [notes, setNotes] = useState('');

  const amountNum = parseFloat(amount);
  const valid = !isNaN(amountNum) && amountNum > 0 && merchant.trim().length > 0;

  // Deterministic keyword heuristic (the RN stand-in for the on-device iOS
  // "Suggest Category" intelligence). Chip appears only when it would change
  // the current pick.
  const suggestion = useMemo(() => suggestCategory(merchant), [merchant]);

  const save = () => {
    if (!valid) return;
    const amt = Math.round(amountNum * 100) / 100;
    const cur = (currency.trim().toUpperCase() || 'USD').slice(0, 3);
    addExpense({
      id: makeId(),
      amount: amt,
      currency: cur,
      category,
      merchant: merchant.trim(),
      date,
      notes: notes.trim() || undefined,
    });
    celebrate({
      title: 'Expense logged',
      subtitle: `${formatMoney(amt, cur)} · ${merchant.trim()}`,
      onDone: () => router.back(),
    });
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      {overlay}
      <ModalHeader title="Add Expense" onSave={save} saveDisabled={!valid} />
      {scanned ? (
        <View style={{ alignItems: 'flex-start', marginBottom: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radii.pill,
              backgroundColor: palette.fillGood,
              borderWidth: 1,
              borderColor: 'rgba(29,185,125,0.35)',
            }}
          >
            <Ionicons name="scan" size={13} color={palette.good} />
            <Text style={{ color: palette.good, fontSize: 12, fontWeight: '700' }}>
              Scanned ✓ — review
            </Text>
          </View>
        </View>
      ) : null}
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
            autoFocus={!scanned}
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={[type.overline, { color: palette.dim }]}>Category</Text>
            {suggestion && suggestion !== category ? (
              <Pressable
                onPress={() => setCategory(suggestion)}
                hitSlop={6}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: palette.fillAccent,
                  borderWidth: 1,
                  borderColor: palette.line,
                }}
              >
                <Ionicons name="sparkles" size={11} color={palette.bright} />
                <Text style={{ color: palette.bright, fontSize: 12, fontWeight: '700' }}>
                  Suggest: {EXPENSE_CATEGORY_META[suggestion].label}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Chips
            options={EXPENSE_CATEGORIES}
            value={category}
            onChange={setCategory}
            labelOf={(c) => EXPENSE_CATEGORY_META[c].label}
          />
        </View>
        <Input label="Date" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} />
      </Card>
    </Screen>
  );
}

// ── Mileage log (iOS LogMileageView) ─────────────────────────────────────────

function MileageForm() {
  const router = useRouter();
  const addExpense = useTravel((s) => s.addExpense);
  const { celebrate, overlay } = useSaveCelebration();

  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [miles, setMiles] = useState('');
  const [notes, setNotes] = useState('');

  const milesNum = parseFloat(miles);
  const amount =
    !isNaN(milesNum) && milesNum > 0
      ? Math.round(milesNum * IRS_MILEAGE_RATE_2026 * 100) / 100
      : null;
  const valid = amount != null && fromAddress.trim().length > 0 && toAddress.trim().length > 0;

  const save = () => {
    if (!valid || amount == null) return;
    addExpense({
      id: makeId(),
      amount,
      currency: 'USD', // IRS reimbursement rate is USD-denominated
      category: 'TRANSPORT',
      merchant: `Mileage — ${fromAddress.trim()} → ${toAddress.trim()}`,
      date: toISODate(),
      notes: notes.trim() || undefined,
    });
    celebrate({
      title: 'Mileage logged',
      subtitle: `${formatMoney(amount, 'USD')} · ${miles} mi`,
      onDone: () => router.back(),
    });
  };

  const transport = EXPENSE_CATEGORY_META.TRANSPORT;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      {overlay}
      <ModalHeader title="Log Mileage" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <Input
          label="From"
          placeholder="SFO Airport"
          value={fromAddress}
          onChangeText={setFromAddress}
          autoFocus
        />
        <Input
          label="To"
          placeholder="Park Hyatt San Francisco"
          value={toAddress}
          onChangeText={setToAddress}
        />
        <Input
          label="Distance (mi)"
          placeholder="0.0"
          value={miles}
          onChangeText={setMiles}
          keyboardType="decimal-pad"
        />

        {/* Reimbursement — auto amount at the IRS standard rate */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: palette.line,
          }}
        >
          <View>
            <Text style={type.body}>Reimbursement</Text>
            <Text style={[type.caption, { marginTop: 2 }]}>
              IRS rate · ${IRS_MILEAGE_RATE_2026.toFixed(2)}/mi (2026)
            </Text>
          </View>
          <Text style={type.stat}>{amount != null ? formatMoney(amount, 'USD') : '—'}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: transport.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={transport.icon as never} size={13} color="#FFFFFF" />
          </View>
          <Text style={type.caption}>Saved as a {transport.label} expense</Text>
        </View>

        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} />
      </Card>
    </Screen>
  );
}
