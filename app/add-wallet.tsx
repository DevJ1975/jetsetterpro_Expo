import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId, toISODate } from '@/src/core/format';
import { WALLET_KINDS, WALLET_META, WalletKind, useWallet } from '@/src/core/store/wallet';

export default function AddWalletScreen() {
  const router = useRouter();
  const add = useWallet((s) => s.add);

  const [kind, setKind] = useState<WalletKind>('ticket');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [code, setCode] = useState('');
  const [date, setDate] = useState(toISODate());

  const valid = title.trim().length > 0;

  const save = () => {
    if (!valid) return;
    add({
      id: makeId(),
      kind,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      code: code.trim() || undefined,
      date,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Pass" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips options={WALLET_KINDS} value={kind} onChange={setKind} labelOf={(k) => WALLET_META[k].label} />
        </View>
        <Input label="Title" placeholder="Museum of Fine Arts" value={title} onChangeText={setTitle} autoFocus />
        <Input label="Subtitle (optional)" placeholder="Boston Pitch Day" value={subtitle} onChangeText={setSubtitle} />
        <Input label="Code / confirmation (optional)" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Input label="Date" value={date} onChangeText={setDate} autoCapitalize="none" />
      </Card>
    </Screen>
  );
}
