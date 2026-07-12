import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { Card, ListRow, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { COUNTRIES, matchCountry } from '@/src/core/data/countries';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

export default function EssentialsScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const tripCountry = useMemo(() => matchCountry(activeOrNextTrip(trips)?.destination), [trips]);

  const flag = (emoji: string) => <Text style={{ fontSize: 22 }}>{emoji}</Text>;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Emergency · tipping · plugs · phrases" title="Travel Essentials" />

      {tripCountry ? (
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <SectionLabel>For your trip</SectionLabel>
          <ListRow
            icon={flag(tripCountry.flag)}
            title={tripCountry.name}
            subtitle={`${tripCountry.currency} · ${tripCountry.emergency}`}
            onPress={() => router.push({ pathname: '/country/[code]', params: { code: tripCountry.code } })}
            last
          />
        </Card>
      ) : null}

      <Card>
        <SectionLabel>All countries</SectionLabel>
        {COUNTRIES.map((c, i) => (
          <ListRow
            key={c.code}
            last={i === COUNTRIES.length - 1}
            icon={flag(c.flag)}
            title={c.name}
            subtitle={c.currency}
            right={<Text style={[type.caption, { color: palette.faint }]}>{c.emergency.split(' ')[0]}</Text>}
            onPress={() => router.push({ pathname: '/country/[code]', params: { code: c.code } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
