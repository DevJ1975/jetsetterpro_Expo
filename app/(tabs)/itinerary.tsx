import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, ScreenHeader, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDateRange, relativeDayLabel } from '@/src/core/format';
import { CalendarSyncBanner } from '@/src/features/itinerary/CalendarSyncBanner';
import { ITINERARY_META } from '@/src/types/models';
import { useTravel } from '@/src/core/store/travel';

export default function ItineraryScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);

  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
        <ScreenHeader
          overline={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}`}
          title="Itinerary"
          right={
            <Pressable
              onPress={() => router.push('/add-trip')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Add trip"
            >
              <Ionicons name="add-circle" size={30} color={palette.accent} />
            </Pressable>
          }
          style={{ paddingHorizontal: 0 }}
        />

        {sorted.length === 0 ? (
          <Card variant="glass">
            <EmptyState
              icon="calendar"
              title="No trips yet"
              subtitle="Create a trip, then add flights, hotels, and cars to it."
              actionLabel="Add a trip"
              onAction={() => router.push('/add-trip')}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {sorted.map((trip) => (
              <Pressable key={trip.id} onPress={() => router.push(`/trip/${trip.id}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.heading}>{trip.name}</Text>
                      <Text style={[type.bodyDim, { marginTop: 2 }]}>{trip.destination}</Text>
                    </View>
                    <Badge tone="accent" label={relativeDayLabel(trip.startDate)} />
                  </View>
                  <Text style={[type.caption, { marginBottom: spacing.md }]}>
                    {formatDateRange(trip.startDate, trip.endDate)} · {trip.items.length}{' '}
                    {trip.items.length === 1 ? 'item' : 'items'}
                  </Text>
                  {trip.items.slice(0, 2).map((item) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}
                    >
                      <IconWell name={ITINERARY_META[item.type].icon} size={16} style={{ width: 32, height: 32, borderRadius: 10 }} />
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                  ))}
                  {trip.items.length > 2 ? (
                    <Text style={[type.caption, { color: palette.bright, marginTop: 4 }]}>
                      +{trip.items.length - 2} more
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
      {/* Slide-down status after a calendar sync (iOS material banner parity). */}
      <CalendarSyncBanner />
    </View>
  );
}
