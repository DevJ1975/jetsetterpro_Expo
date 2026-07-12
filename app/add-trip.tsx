import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Card, Input, SectionLabel, spacing } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { makeId, toISODate } from '@/src/core/format';
import { useTravel } from '@/src/core/store/travel';

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export default function AddTripScreen() {
  const router = useRouter();
  const addTrip = useTravel((s) => s.addTrip);

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(toISODate());
  const [endDate, setEndDate] = useState(addDaysISO(3));

  const valid = name.trim().length > 0 && destination.trim().length > 0;

  const save = () => {
    if (!valid) return;
    addTrip({
      id: makeId(),
      name: name.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      items: [],
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="New Trip" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <SectionLabel>Trip details</SectionLabel>
        <Input label="Trip name" placeholder="Boston Pitch Day" value={name} onChangeText={setName} autoFocus />
        <Input label="Destination" placeholder="Boston, MA" value={destination} onChangeText={setDestination} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Start (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} style={{ flex: 1 }} autoCapitalize="none" />
          <Input label="End (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} style={{ flex: 1 }} autoCapitalize="none" />
        </View>
      </Card>
    </Screen>
  );
}
