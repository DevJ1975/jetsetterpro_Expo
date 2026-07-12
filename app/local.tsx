import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Card, Input, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

const CATEGORIES: { label: string; icon: string; q: string }[] = [
  { label: 'Restaurants', icon: 'restaurant', q: 'best restaurants' },
  { label: 'Attractions', icon: 'camera', q: 'top attractions' },
  { label: 'Cafés', icon: 'cafe', q: 'cafes' },
  { label: 'Nightlife', icon: 'wine', q: 'nightlife bars' },
  { label: 'Events', icon: 'calendar', q: 'events this week' },
  { label: 'Shopping', icon: 'bag-handle', q: 'shopping' },
];

export default function LocalExperiencesScreen() {
  const trips = useTravel((s) => s.trips);
  const suggested = useMemo(() => activeOrNextTrip(trips)?.destination ?? '', [trips]);
  const [dest, setDest] = useState(suggested);

  const explore = (q: string) => {
    if (!dest.trim()) return;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${q} in ${dest.trim()}`)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Restaurants · events · hidden gems" title="Local Experiences" />

      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <SectionLabel>Where</SectionLabel>
        <Input label="Destination" placeholder="Tokyo, Japan" value={dest} onChangeText={setDest} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => explore(c.q)}
            style={{
              width: '47%',
              flexGrow: 1,
              backgroundColor: palette.surface,
              borderColor: palette.line,
              borderWidth: 1,
              borderRadius: radii.card,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: palette.fillAccent,
                borderWidth: 1,
                borderColor: palette.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={c.icon as never} size={20} color={palette.bright} />
            </View>
            <Text style={type.sub}>{c.label}</Text>
            <Text style={[type.caption, { color: palette.bright }]}>Explore →</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Opens Google Maps for your destination. AI-ranked picks + Eventbrite connect in a later update.
      </Text>
    </Screen>
  );
}
