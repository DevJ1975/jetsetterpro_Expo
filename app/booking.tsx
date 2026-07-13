import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Card, Input, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { toISODate } from '@/src/core/format';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

// Hoisted to module scope — defining a component inside render remounts it (and
// drops its state) every render, which the react-hooks/static-components rule flags.
function ProviderRows({
  items,
  onOpen,
}: {
  items: { name: string; url: string }[];
  onOpen: (url: string) => void;
}) {
  return (
    <>
      {items.map((p, i) => (
        <Pressable
          key={p.name}
          onPress={() => onOpen(p.url)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            borderBottomWidth: i === items.length - 1 ? 0 : 0.5,
            borderBottomColor: palette.line,
          }}
        >
          <Text style={type.sub}>{p.name}</Text>
          <Text style={[type.body, { color: palette.bright }]}>Search →</Text>
        </Pressable>
      ))}
    </>
  );
}

export default function BookingScreen() {
  const trips = useTravel((s) => s.trips);
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);

  const [dest, setDest] = useState((trip?.destination ?? '').split(',')[0].trim());
  const [checkin, setCheckin] = useState(trip?.startDate ?? toISODate());
  const [checkout, setCheckout] = useState(trip?.endDate ?? toISODate());

  const go = (url: string) => Linking.openURL(url).catch(() => {});
  const place = encodeURIComponent(dest.trim() || 'destination');

  const flights = [
    { name: 'Google Flights', url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights to ${dest} on ${checkin}`)}` },
    { name: 'Kayak', url: `https://www.kayak.com/flights?destination=${place}` },
  ];
  const hotels = [
    { name: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${place}&checkin=${checkin}&checkout=${checkout}` },
    { name: 'Kayak Hotels', url: `https://www.kayak.com/hotels/${place}/${checkin}/${checkout}` },
  ];

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Flights & hotels" title="Book" />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Trip</SectionLabel>
        <Input label="Destination" placeholder="Tokyo" value={dest} onChangeText={setDest} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Check-in" value={checkin} onChangeText={setCheckin} autoCapitalize="none" style={{ flex: 1 }} />
          <Input label="Check-out" value={checkout} onChangeText={setCheckout} autoCapitalize="none" style={{ flex: 1 }} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Flights</SectionLabel>
        <ProviderRows items={flights} onOpen={go} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Hotels</SectionLabel>
        <ProviderRows items={hotels} onOpen={go} />
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Opens each provider with your dates. In-app booking (Duffel/Expedia) connects in a later update.
      </Text>
    </Screen>
  );
}
