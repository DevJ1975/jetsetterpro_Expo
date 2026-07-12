import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId } from '@/src/core/format';
import { DOC_META, DOC_TYPES, DocType, setDocNumber, useVault } from '@/src/core/store/vault';

export default function AddDocumentScreen() {
  const router = useRouter();
  const addMeta = useVault((s) => s.addMeta);

  const [docType, setDocType] = useState<DocType>('passport');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');

  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    const id = makeId();
    const num = number.trim();
    if (num) await setDocNumber(id, num); // → encrypted keychain, never in plain storage
    addMeta({
      id,
      type: docType,
      name: name.trim(),
      expiry: expiry.trim() || undefined,
      hasNumber: num.length > 0,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Document" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips options={DOC_TYPES} value={docType} onChange={setDocType} labelOf={(t) => DOC_META[t].label} />
        </View>
        <Input label="Name / label" placeholder="US Passport" value={name} onChangeText={setName} autoFocus />
        <Input
          label="Number (encrypted)"
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          secureTextEntry
        />
        <Input label="Expiration (YYYY-MM-DD, optional)" value={expiry} onChangeText={setExpiry} autoCapitalize="none" />
      </Card>
    </Screen>
  );
}
