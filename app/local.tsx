import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Card, Input, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { formatDistance, usePlaces, type Place, type PlaceCategory } from '@/src/core/api/places';

type CatKey = PlaceCategory | 'events';
const CATEGORIES: { key: CatKey; label: string; icon: string }[] = [
  { key: 'restaurants', label: 'Restaurants', icon: 'restaurant' },
  { key: 'attractions', label: 'Attractions', icon: 'camera' },
  { key: 'cafes', label: 'Cafés', icon: 'cafe' },
  { key: 'nightlife', label: 'Nightlife', icon: 'wine' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle' },
  { key: 'events', label: 'Events', icon: 'calendar' },
];

function mapsUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function LocalExperiencesScreen() {
  const trips = useTravel((s) => s.trips);
  const suggested = useMemo(() => activeOrNextTrip(trips)?.destination ?? '', [trips]);
  const [dest, setDest] = useState(suggested);
  const [cat, setCat] = useState<CatKey | null>(null);

  const liveCat = cat && cat !== 'events' ? cat : null;
  const query = usePlaces(dest.trim() || undefined, liveCat);

  const openPlace = (p: Place) => {
    Linking.openURL(mapsUrl(`${p.name}, ${dest.trim()}`)).catch(() => {});
  };
  const searchAll = (label: string) => {
    if (!dest.trim()) return;
    Linking.openURL(mapsUrl(`${label} in ${dest.trim()}`)).catch(() => {});
  };

  const select = (key: CatKey) => {
    if (!dest.trim()) return;
    setCat(key);
  };

  // Clearing the destination invalidates the selected category — otherwise the
  // disabled query renders a "undefined nearby" results card with no rows.
  const onDestChange = (v: string) => {
    setDest(v);
    if (!v.trim()) setCat(null);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Restaurants · attractions · nightlife" title="Local Experiences" />

      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <SectionLabel>Where</SectionLabel>
        <Input label="Destination" placeholder="Tokyo, Japan" value={dest} onChangeText={onDestChange} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {CATEGORIES.map((c) => {
          const on = cat === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => select(c.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: on ? palette.accent : palette.line,
                backgroundColor: on ? palette.accent : palette.fillAccent,
                opacity: dest.trim() ? 1 : 0.5,
              }}
            >
              <Ionicons name={c.icon as never} size={15} color={on ? '#04101F' : palette.bright} />
              <Text style={{ color: on ? '#04101F' : palette.text, fontSize: 13, fontWeight: '600' }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!cat ? (
        <Card variant="glass">
          <EmptyState
            icon="compass"
            title="Pick a category"
            subtitle="Live nearby places for your destination appear here, ranked by distance."
          />
        </Card>
      ) : cat === 'events' ? (
        <Card variant="glass" style={{ gap: spacing.md }}>
          <Text style={type.sub}>What’s on in {dest.trim()}</Text>
          <Text style={type.bodyDim}>
            Live event listings connect with a ticketing provider in a later update. For now, search what’s
            happening now:
          </Text>
          <Pressable
            onPress={() => searchAll('events this week')}
            style={{
              height: 44,
              borderRadius: radii.control,
              backgroundColor: palette.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#04101F', fontWeight: '700' }}>Search events on Google</Text>
          </Pressable>
        </Card>
      ) : query.isLoading ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator color={palette.bright} />
          <Text style={type.bodyDim}>Finding places near {dest.trim()}…</Text>
        </View>
      ) : query.isError || (query.data && query.data.length === 0) ? (
        <Card variant="glass" style={{ gap: spacing.md }}>
          <EmptyState
            icon="cloud-offline"
            title={query.isError ? 'Couldn’t load live places' : 'Nothing found nearby'}
            subtitle="Search on Google Maps instead."
          />
          <Pressable
            onPress={() => searchAll(CATEGORIES.find((c) => c.key === cat)?.label ?? '')}
            style={{
              height: 44,
              borderRadius: radii.control,
              backgroundColor: palette.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#04101F', fontWeight: '700' }}>Open in Google Maps</Text>
          </Pressable>
        </Card>
      ) : (
        <Card style={{ gap: 2 }}>
          <SectionLabel>
            {query.data?.length} nearby · by distance
          </SectionLabel>
          {query.data?.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => openPlace(p)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: palette.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={type.sub}>{p.name}</Text>
                <Text style={[type.bodyDim, { marginTop: 2 }]}>{p.kind}</Text>
              </View>
              <Text style={[type.caption, { color: palette.bright }]}>{formatDistance(p.distanceM)}</Text>
              <Ionicons name="chevron-forward" size={16} color={palette.faint} />
            </Pressable>
          ))}
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
            Live places from OpenStreetMap. Tap to open in Maps.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
