import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';

function parseRoute(title: string): { origin: string; dest: string } {
  const m = title.match(/([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})/i);
  return m ? { origin: m[1].toUpperCase(), dest: m[2].toUpperCase() } : { origin: '', dest: '' };
}

function AirportRow({ iata }: { iata: string }) {
  if (!iata) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(`${iata} airport`)}`).catch(() => {})}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name="airplane" size={20} color={palette.bright} />
        <Text style={type.sub}>{iata}</Text>
      </View>
      <Text style={[type.body, { color: palette.bright }]}>Open in Maps →</Text>
    </Pressable>
  );
}

const AMENITIES = ['Lounges', 'Dining', 'Restrooms', 'Charging', 'ATMs', 'Baggage claim'];

export default function AirportMapScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const route = flight ? parseRoute(flight.item.title) : { origin: '', dest: '' };

  if (!flight) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Airport Map" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="map" title="No upcoming flight" subtitle="Airport guidance appears here for your next departure." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={flight.item.title} title="Airport Map" />

      {flight.item.location ? (
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Your gate</SectionLabel>
          <Text style={type.display}>{flight.item.location}</Text>
        </Card>
      ) : null}

      <Card>
        <SectionLabel>Airports</SectionLabel>
        <AirportRow iata={route.origin} />
        <View style={{ height: 0.5, backgroundColor: palette.line }} />
        <AirportRow iata={route.dest} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Amenities</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {AMENITIES.map((a) => (
            <View
              key={a}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.fillAccent,
              }}
            >
              <Text style={{ color: palette.dim, fontSize: 13 }}>{a}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Indoor gate-to-gate wayfinding connects with an airport maps provider (IMDF) in a later update.
      </Text>
    </Screen>
  );
}
