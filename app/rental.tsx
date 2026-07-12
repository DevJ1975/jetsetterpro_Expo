import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Card, Input, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { toISODate } from '@/src/core/format';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

const PROVIDERS: { name: string; url: string }[] = [
  { name: 'Enterprise', url: 'https://www.enterprise.com/en/car-rental.html' },
  { name: 'Hertz', url: 'https://www.hertz.com' },
  { name: 'National', url: 'https://www.nationalcar.com' },
];

export default function RentalCarScreen() {
  const trips = useTravel((s) => s.trips);
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);

  const [where, setWhere] = useState((trip?.destination ?? '').split(',')[0].trim());
  const [pickup, setPickup] = useState(trip?.startDate ?? toISODate());
  const [dropoff, setDropoff] = useState(trip?.endDate ?? toISODate());

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  const compareKayak = () => {
    const place = encodeURIComponent(where.trim() || 'airport');
    open(`https://www.kayak.com/cars/${place}/${pickup}/${dropoff}`);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Enterprise · Hertz · National" title="Rental Cars" />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Search</SectionLabel>
        <Input label="Pickup location" placeholder="Boston" value={where} onChangeText={setWhere} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Pickup" value={pickup} onChangeText={setPickup} autoCapitalize="none" style={{ flex: 1 }} />
          <Input label="Drop-off" value={dropoff} onChangeText={setDropoff} autoCapitalize="none" style={{ flex: 1 }} />
        </View>
        <Button title="Compare on Kayak" size="lg" onPress={compareKayak} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Book direct</SectionLabel>
        {PROVIDERS.map((p, i) => (
          <Pressable
            key={p.name}
            onPress={() => open(p.url)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: i === PROVIDERS.length - 1 ? 0 : 0.5,
              borderBottomColor: palette.line,
            }}
          >
            <Text style={type.sub}>{p.name}</Text>
            <Text style={[type.body, { color: palette.bright }]}>Open →</Text>
          </Pressable>
        ))}
      </Card>

      <Card variant="outline" style={{ marginTop: spacing.lg }}>
        <Text style={type.bodyDim}>
          Opens each provider with your trip dates. In-app live rates + corporate codes arrive when
          provider accounts are connected in a later update.
        </Text>
      </Card>
    </Screen>
  );
}
