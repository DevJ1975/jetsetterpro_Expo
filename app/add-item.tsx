import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId, toISODate } from '@/src/core/format';
import { ITINERARY_META, ItineraryItemType } from '@/src/types/models';
import { useTravel } from '@/src/core/store/travel';

const TYPES: ItineraryItemType[] = ['flight', 'hotel', 'car', 'activity', 'restaurant', 'other'];

export default function AddItemScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const addItem = useTravel((s) => s.addItineraryItem);

  const [itemType, setItemType] = useState<ItineraryItemType>('flight');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toISODate());
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const valid = !!tripId && title.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const start = new Date(`${date}T${time || '09:00'}:00`);
    addItem(tripId, {
      id: makeId(),
      type: itemType,
      title: title.trim(),
      startDate: isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString(),
      location: location.trim() || undefined,
      confirmation: confirmation.trim() || undefined,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Item" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips
            options={TYPES}
            value={itemType}
            onChange={setItemType}
            labelOf={(t) => ITINERARY_META[t].label}
          />
        </View>
        <Input label="Title" placeholder="DL2244 · JFK → BOS" value={title} onChangeText={setTitle} autoFocus />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Date" value={date} onChangeText={setDate} style={{ flex: 1 }} autoCapitalize="none" />
          <Input label="Time (HH:MM)" value={time} onChangeText={setTime} style={{ width: 120 }} autoCapitalize="none" />
        </View>
        <Input label="Location" placeholder="Gate B27 · Seat 1A" value={location} onChangeText={setLocation} />
        <Input label="Confirmation #" placeholder="HXR7QK" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
      </Card>
    </Screen>
  );
}
