import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { formatByCurrency } from '@/src/core/expenses';
import { CATEGORY_META, Expense } from '@/src/types/models';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

function buildHtml(expenses: Expense[], name: string): string {
  const rows = expenses
    .map(
      (e) =>
        `<tr><td>${e.date}</td><td>${esc(e.merchant)}</td><td>${CATEGORY_META[e.category].label}</td><td class="r">${e.amount.toFixed(2)} ${e.currency}</td></tr>`,
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

export default function ExpenseExportScreen() {
  const expenses = useTravel((s) => s.expenses);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const name = usePreferences((s) => s.name);
  const [busy, setBusy] = useState(false);

  // Per-currency, to match the PDF (buildHtml) — never a cross-currency sum.
  const totalLabel = useMemo(() => formatByCurrency(expenses, homeCurrency), [expenses, homeCurrency]);

  const exportPdf = async () => {
    if (expenses.length === 0 || busy) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(expenses, name) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Report ready', `Saved to ${uri}`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not generate the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Email · Expensify · Ramp · Brex" title="Submit Expenses" />
      <PremiumGate feature="Submit Expenses">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {expenses.length === 0 ? (
            <Card variant="glass">
              <EmptyState icon="send" title="No expenses to submit" subtitle="Log expenses first, then export or submit them." />
            </Card>
          ) : (
            <>
              <Card variant="glass">
                <SectionLabel>Report</SectionLabel>
                <Text style={type.display}>{totalLabel}</Text>
                <Text style={[type.bodyDim, { marginTop: 4 }]}>{expenses.length} expenses ready to export</Text>
              </Card>
              <Button
                title={busy ? 'Preparing…' : 'Export PDF & share'}
                size="lg"
                onPress={exportPdf}
                disabled={busy}
                style={{ marginTop: spacing.xl }}
              />
              <Card variant="outline" style={{ marginTop: spacing.lg }}>
                <Text style={type.bodyDim}>
                  Direct submission to Expensify, Ramp, Brex, and Divvy connects your account in a
                  later update. For now, export a PDF and send it however you like.
                </Text>
              </Card>
            </>
          )}
        </View>
      </PremiumGate>
    </Screen>
  );
}
