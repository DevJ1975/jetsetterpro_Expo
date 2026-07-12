import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { Badge, Card, ListRow, SectionLabel, spacing } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { COUNTRIES, VISA_META } from '@/src/core/data/countries';

export default function VisaScreen() {
  const router = useRouter();
  const rows = COUNTRIES.filter((c) => c.visa.status !== 'home');

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="US passport" title="Visa Requirements" />
      <Card>
        <SectionLabel>Entry rules</SectionLabel>
        {rows.map((c, i) => {
          const meta = VISA_META[c.visa.status];
          return (
            <ListRow
              key={c.code}
              last={i === rows.length - 1}
              icon={<Text style={{ fontSize: 22 }}>{c.flag}</Text>}
              title={c.name}
              subtitle={c.visa.stay ? `Up to ${c.visa.stay}` : c.visa.note}
              right={<Badge tone={meta.tone} label={meta.label} />}
              onPress={() => router.push({ pathname: '/country/[code]', params: { code: c.code } })}
            />
          );
        })}
      </Card>
    </Screen>
  );
}
