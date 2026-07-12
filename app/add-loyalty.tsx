import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId } from '@/src/core/format';
import { LOYALTY_KINDS, LOYALTY_META, LoyaltyKind, useLoyalty } from '@/src/core/store/loyalty';

export default function AddLoyaltyScreen() {
  const router = useRouter();
  const add = useLoyalty((s) => s.add);

  const [kind, setKind] = useState<LoyaltyKind>('airline');
  const [program, setProgram] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [tier, setTier] = useState('');
  const [points, setPoints] = useState('');

  const valid = program.trim().length > 0 && memberNumber.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const pts = parseInt(points.replace(/[^0-9]/g, ''), 10);
    add({
      id: makeId(),
      kind,
      program: program.trim(),
      memberNumber: memberNumber.trim(),
      tier: tier.trim() || undefined,
      points: isNaN(pts) ? undefined : pts,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} edges={['top']}>
      <ModalHeader title="Add Program" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips options={LOYALTY_KINDS} value={kind} onChange={setKind} labelOf={(k) => LOYALTY_META[k].label} />
        </View>
        <Input label="Program" placeholder="Delta SkyMiles" value={program} onChangeText={setProgram} autoFocus />
        <Input label="Member number" value={memberNumber} onChangeText={setMemberNumber} autoCapitalize="characters" />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Tier (optional)" placeholder="Gold" value={tier} onChangeText={setTier} style={{ flex: 1 }} />
          <Input label="Points (optional)" value={points} onChangeText={setPoints} keyboardType="number-pad" style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}
