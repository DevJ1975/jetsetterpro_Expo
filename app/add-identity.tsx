import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId } from '@/src/core/format';
import { IDENTITY_KINDS, IDENTITY_META, IdentityKind, useIdentity } from '@/src/core/store/identity';

export default function AddIdentityScreen() {
  const router = useRouter();
  const add = useIdentity((s) => s.add);

  const [kind, setKind] = useState<IdentityKind>('preCheck');
  const [number, setNumber] = useState('');
  const [expiration, setExpiration] = useState('');

  const valid = number.trim().length > 0;

  const save = () => {
    if (!valid) return;
    add({
      id: makeId(),
      kind,
      number: number.trim(),
      expiration: expiration.trim() || undefined,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Credential" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips options={IDENTITY_KINDS} value={kind} onChange={setKind} labelOf={(k) => IDENTITY_META[k].label} />
        </View>
        <Input label="Number" value={number} onChangeText={setNumber} autoCapitalize="characters" autoFocus />
        <Input label="Expiration (YYYY-MM-DD, optional)" value={expiration} onChangeText={setExpiration} autoCapitalize="none" />
      </Card>
    </Screen>
  );
}
