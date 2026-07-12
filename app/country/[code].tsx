import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { COUNTRIES, VISA_META } from '@/src/core/data/countries';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: spacing.lg }}>
      <Text style={[type.body, { color: '#8B92A8' }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const c = COUNTRIES.find((x) => x.code === code);

  if (!c) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Country" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="globe" title="Not found" />
        </View>
      </Screen>
    );
  }

  const visa = VISA_META[c.visa.status];

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={`${c.flag}  ${c.currency}`} title={c.name} />

      <Card variant="glass" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <SectionLabel>Entry (US passport)</SectionLabel>
          </View>
          <Badge tone={visa.tone} label={visa.label} />
        </View>
        {c.visa.stay ? <Text style={type.body}>Allowed stay: {c.visa.stay}</Text> : null}
        {c.visa.note ? <Text style={type.bodyDim}>{c.visa.note}</Text> : null}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Emergency</SectionLabel>
        <Text style={type.heading}>{c.emergency}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Money & Power</SectionLabel>
        <Row label="Currency" value={c.currency} />
        <Row label="Tipping" value={c.tipping} />
        <Row label="Outlets" value={c.plug} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Key phrases</SectionLabel>
        <Row label="Hello" value={c.phrases.hello} />
        <Row label="Thank you" value={c.phrases.thanks} />
        <Row label="Help" value={c.phrases.help} />
      </Card>
    </Screen>
  );
}
