import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Input, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { convertCurrency } from '@/src/core/api/exchange';
import { formatMoney } from '@/src/core/format';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

export default function CurrencyScreen() {
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const expenses = useTravel((s) => s.expenses);

  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState(homeCurrency || 'USD');
  const [to, setTo] = useState('JPY');
  const [result, setResult] = useState<{ converted: number; rate: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const convert = async () => {
    const n = parseFloat(amount);
    if (isNaN(n)) return;
    setStatus('loading');
    const r = await convertCurrency(n, from, to);
    if (r) {
      setResult(r);
      setStatus('idle');
    } else {
      setResult(null);
      setStatus('error');
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
  };

  const spendByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.currency, (m.get(e.currency) ?? 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Live rates" title="Currency & Expenses" />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Converter</SectionLabel>
        <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
          <Input label="From" value={from} onChangeText={setFrom} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
          <Pressable onPress={swap} hitSlop={10} style={{ paddingBottom: 12 }}>
            <Ionicons name="swap-horizontal" size={24} color={palette.bright} />
          </Pressable>
          <Input label="To" value={to} onChangeText={setTo} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
        </View>

        <Pressable
          onPress={convert}
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
            <Text style={type.stat}>
              {formatMoney(result.converted, to.toUpperCase())}
            </Text>
            <Text style={[type.caption, { marginTop: 2 }]}>
              1 {from.toUpperCase()} = {result.rate.toFixed(4)} {to.toUpperCase()}
            </Text>
          </View>
        ) : status === 'error' ? (
          <Text style={[type.caption, { color: palette.bad }]}>
            Couldn&apos;t fetch a rate — check the currency codes.
          </Text>
        ) : null}
      </Card>

      {spendByCurrency.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionLabel>Trip spend</SectionLabel>
          {spendByCurrency.map(([code, total]) => (
            <View
              key={code}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
            >
              <Text style={type.body}>{code}</Text>
              <Text style={type.sub}>{formatMoney(total, code)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
