import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId } from '@/src/core/format';
import { BAG_STATUSES, BAG_STATUS_META, BagStatus, useLuggage } from '@/src/core/store/luggage';

export default function AddBagScreen() {
  const router = useRouter();
  const add = useLuggage((s) => s.add);

  const [label, setLabel] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [status, setStatus] = useState<BagStatus>('checked');

  const valid = label.trim().length > 0;

  const save = () => {
    if (!valid) return;
    add({
      id: makeId(),
      label: label.trim(),
      tagNumber: tagNumber.trim() || undefined,
      airline: airline.trim() || undefined,
      status,
      updatedAt: new Date().toISOString(),
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Bag" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <Input label="Label" placeholder="Black roller" value={label} onChangeText={setLabel} autoFocus />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Tag number" value={tagNumber} onChangeText={setTagNumber} autoCapitalize="characters" style={{ flex: 1 }} />
          <Input label="Airline" value={airline} onChangeText={setAirline} style={{ flex: 1 }} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Status</Text>
          <Chips options={BAG_STATUSES} value={status} onChange={setStatus} labelOf={(s) => BAG_STATUS_META[s].label} />
        </View>
      </Card>
    </Screen>
  );
}
