import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Card, Input, ListRow, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { COUNTRIES, COUNTRY_ALIASES, matchCountry, type CountryInfo } from '@/src/core/data/countries';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

/** Case-insensitive directory filter with alias resolution ("holland" → NL,
 *  "uk" → GB — ported from the iOS CountryPickerSheet alias list). An alias hit
 *  takes priority so short queries like "uk"/"uae" resolve to the intended
 *  country rather than incidental substring matches. Pure. */
function filterCountries(query: string): CountryInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const aliasCode = COUNTRY_ALIASES[q];
  if (aliasCode) {
    const hit = COUNTRIES.find((c) => c.code === aliasCode);
    if (hit) return [hit];
  }
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
  );
}

export default function EssentialsScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const tripCountry = useMemo(() => matchCountry(activeOrNextTrip(trips)?.destination), [trips]);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterCountries(search), [search]);

  const flag = (emoji: string) => <Text style={{ fontSize: 22 }}>{emoji}</Text>;
  const openCountry = (code: string) =>
    router.push({ pathname: '/country/[code]', params: { code } });

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Emergency · tipping · plugs · phrases" title="Travel Essentials" />

      {tripCountry ? (
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <SectionLabel>For your trip</SectionLabel>
          <ListRow
            icon={flag(tripCountry.flag)}
            title={tripCountry.name}
            subtitle={[tripCountry.region, tripCountry.currency].filter(Boolean).join(' · ')}
            right={<Text style={[type.caption, { color: palette.bright }]}>Open →</Text>}
            onPress={() => openCountry(tripCountry.code)}
            last
          />
        </Card>
      ) : (
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Pick your destination</SectionLabel>
          <Text style={type.bodyDim}>
            Choose a country to see local emergency numbers, tipping etiquette, plug types, and
            water-safety advice.
          </Text>
        </Card>
      )}

      <Card>
        <SectionLabel>All countries</SectionLabel>
        <Input
          placeholder="Search countries (try “Holland” or “UK”)"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ marginBottom: spacing.md }}
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon="globe"
            title="No matches"
            subtitle="Try the country's English name or its two-letter code."
          />
        ) : (
          filtered.map((c, i) => (
            <ListRow
              key={c.code}
              last={i === filtered.length - 1}
              icon={flag(c.flag)}
              title={c.name}
              subtitle={[c.region, c.currency].filter(Boolean).join(' · ')}
              right={
                <Text style={[type.caption, { color: palette.faint }]}>
                  {c.emergency.split(' ')[0]}
                </Text>
              }
              onPress={() => openCountry(c.code)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
