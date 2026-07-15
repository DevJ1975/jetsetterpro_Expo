import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, ListRow, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { addTripToCalendar } from '@/src/core/services/calendar';
import { formatDateRange, formatMoney, formatTime } from '@/src/core/format';
import { CalendarSyncBanner } from '@/src/features/itinerary/CalendarSyncBanner';
import { useCalendarBanner } from '@/src/features/itinerary/calendarBanner';
import { ITINERARY_META, type ItineraryItem } from '@/src/types/models';
import { useTravel } from '@/src/core/store/travel';

/** One-line row subtitle: time · location · booking facts (seat / cabin /
 *  terminal / gate / room / cost) when present — iOS ItineraryItemRowView. */
function itemSubtitle(item: ItineraryItem): string {
  const parts: string[] = [formatTime(item.startDate)];
  if (item.location) parts.push(item.location);
  if (item.seat) parts.push(`Seat ${item.seat}`);
  if (item.cabinClass) parts.push(item.cabinClass);
  if (item.terminal) {
    parts.push(/^\d+$/.test(item.terminal) ? `Terminal ${item.terminal}` : item.terminal);
  }
  if (item.gate) parts.push(/^gate/i.test(item.gate) ? item.gate : `Gate ${item.gate}`);
  if (item.roomType) parts.push(item.roomType);
  if (item.cost != null) parts.push(formatMoney(item.cost, item.currency || 'USD'));
  return parts.join(' · ');
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trip = useTravel((s) => s.trips.find((t) => t.id === id));
  const removeTrip = useTravel((s) => s.removeTrip);
  const removeItem = useTravel((s) => s.removeItineraryItem);
  const showBanner = useCalendarBanner((s) => s.show);
  const [syncing, setSyncing] = useState(false);

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Trip" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="calendar" title="Trip not found" />
        </View>
      </Screen>
    );
  }

  const syncCalendar = async () => {
    setSyncing(true);
    const result = await addTripToCalendar(trip);
    setSyncing(false);
    // Success surfaces as the slide-down banner (iOS material banner parity);
    // failures still explain themselves in an alert.
    if (result) showBanner(`${result.added} event${result.added === 1 ? '' : 's'} added to Calendar`);
    else Alert.alert('Calendar unavailable', 'Grant calendar access in a development build to sync.');
  };

  const confirmDeleteTrip = () => {
    Alert.alert('Delete trip?', `"${trip.name}" and its items will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTrip(trip.id);
          router.back();
        },
      },
    ]);
  };

  const editItem = (item: ItineraryItem) =>
    router.push({ pathname: '/add-item', params: { tripId: trip.id, itemId: item.id } });

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
        <BackHeader
          overline={formatDateRange(trip.startDate, trip.endDate)}
          title={trip.name}
          right={
            <Pressable
              onPress={() => router.push({ pathname: '/add-item', params: { tripId: trip.id } })}
              hitSlop={12}
            >
              <Ionicons name="add-circle" size={30} color={palette.accent} />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: spacing.xl }}>
          <Card>
            <SectionLabel>Itinerary</SectionLabel>
            {trip.items.length === 0 ? (
              <EmptyState
                icon="add-circle"
                title="No items yet"
                subtitle="Add flights, hotels, and cars to this trip."
                actionLabel="Add item"
                onAction={() => router.push({ pathname: '/add-item', params: { tripId: trip.id } })}
              />
            ) : (
              trip.items.map((item, i) => (
                <ListRow
                  key={item.id}
                  last={i === trip.items.length - 1}
                  icon={<IconWell name={ITINERARY_META[item.type].icon} size={18} />}
                  title={item.title}
                  subtitle={itemSubtitle(item)}
                  onPress={() => editItem(item)}
                  right={
                    <Pressable
                      onPress={() =>
                        Alert.alert('Remove item?', item.title, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeItem(trip.id, item.id) },
                        ])
                      }
                      hitSlop={10}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={palette.faint} />
                    </Pressable>
                  }
                />
              ))
            )}
            {trip.items.length > 0 ? (
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Tap an item to edit its booking details.
              </Text>
            ) : null}
          </Card>

          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <Button
              title={syncing ? 'Adding…' : 'Add trip to Calendar'}
              variant="secondary"
              size="md"
              disabled={syncing}
              onPress={syncCalendar}
            />
            <Button title="Delete trip" variant="danger" size="md" onPress={confirmDeleteTrip} />
          </View>

          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
            {trip.destination}
          </Text>
        </View>
      </Screen>
      <CalendarSyncBanner />
    </View>
  );
}
