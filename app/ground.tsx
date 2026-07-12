import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { Card, Input, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

export default function GroundTransportScreen() {
  const trips = useTravel((s) => s.trips);
  const suggested = useMemo(() => activeOrNextTrip(trips)?.destination ?? '', [trips]);
  const [dest, setDest] = useState(suggested);

  const open = async (which: 'uber' | 'lyft') => {
    const addr = encodeURIComponent(dest.trim());
    const url =
      which === 'uber'
        ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${addr}`
        : `https://ride.lyft.com/?destination=${addr}`;
    try {
      await Linking.openURL(url);
    } catch {
      /* app/web not available */
    }
  };

  const canGo = dest.trim().length > 0;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Uber & Lyft" title="Ground Transport" />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Where to?</SectionLabel>
        <Input label="Destination" placeholder="Airport or address" value={dest} onChangeText={setDest} />

        <Pressable
          onPress={() => open('uber')}
          disabled={!canGo}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 52,
            borderRadius: 14,
            backgroundColor: '#000000',
            opacity: canGo ? 1 : 0.4,
          }}
        >
          <Ionicons name="car" size={20} color="#FFFFFF" />
          <Text style={[type.sub, { color: '#FFFFFF' }]}>Open in Uber</Text>
        </Pressable>

        <Pressable
          onPress={() => open('lyft')}
          disabled={!canGo}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 52,
            borderRadius: 14,
            backgroundColor: '#FF00BF',
            opacity: canGo ? 1 : 0.4,
          }}
        >
          <Ionicons name="car-sport" size={20} color="#FFFFFF" />
          <Text style={[type.sub, { color: '#FFFFFF' }]}>Open in Lyft</Text>
        </Pressable>
      </Card>

      <Card variant="outline" style={{ marginTop: spacing.lg }}>
        <Text style={type.bodyDim}>
          Opens the ride app with your destination prefilled. Live in-app fare estimates arrive when
          Uber/Lyft accounts are connected in a later update.
        </Text>
      </Card>
    </Screen>
  );
}
