import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, ProgressBar, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { generatePackingList } from '@/src/features/packing/generate';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

export default function PackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const setPackingList = useTravel((s) => s.setPackingList);
  const togglePackingItem = useTravel((s) => s.togglePackingItem);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );

  const items = useMemo(() => trip?.packingList ?? [], [trip]);
  const packed = items.filter((i) => i.packed).length;
  const grouped = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const i of items) {
      const arr = m.get(i.category ?? 'Other') ?? [];
      arr.push(i);
      m.set(i.category ?? 'Other', arr);
    }
    return [...m.entries()];
  }, [items]);

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Packing List" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="briefcase" title="No trip to pack for" subtitle="Add a trip first." />
        </View>
      </Screen>
    );
  }

  const generate = () => setPackingList(trip.id, generatePackingList(trip, trip.packingList));

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline={trip.name} title="Smart Packing List" />
      <PremiumGate feature="Smart Packing List">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {items.length === 0 ? (
            <Card variant="glass">
              <EmptyState
                icon="briefcase"
                title="Ready when you are"
                subtitle={`Generate a packing list tailored to your ${trip.destination} trip.`}
                actionLabel="Generate list"
                onAction={generate}
              />
            </Card>
          ) : (
            <>
              <Card variant="glass" style={{ gap: spacing.md }}>
                <SectionLabel>Progress</SectionLabel>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
                  <Text style={type.stat}>
                    {packed}/{items.length}
                  </Text>
                  <Text style={type.bodyDim}>packed</Text>
                </View>
                <ProgressBar value={items.length ? packed / items.length : 0} />
              </Card>

              {grouped.map(([category, rows]) => (
                <Card key={category} style={{ marginTop: spacing.lg }}>
                  <SectionLabel>{category}</SectionLabel>
                  {rows.map((it, i) => (
                    <Pressable
                      key={it.id}
                      onPress={() => togglePackingItem(trip.id, it.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        paddingVertical: 10,
                        borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
                        borderBottomColor: palette.line,
                      }}
                    >
                      <Ionicons
                        name={it.packed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={it.packed ? palette.good : palette.faint}
                      />
                      <Text
                        style={[
                          type.body,
                          it.packed && { color: palette.faint, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {it.label}
                      </Text>
                    </Pressable>
                  ))}
                </Card>
              ))}

              <Button
                title="Regenerate"
                variant="secondary"
                size="md"
                onPress={generate}
                style={{ marginTop: spacing.xl }}
              />
            </>
          )}
        </View>
      </PremiumGate>
    </Screen>
  );
}
