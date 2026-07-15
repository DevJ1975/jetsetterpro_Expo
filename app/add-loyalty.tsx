// Add / edit a loyalty program — RN port of the iOS `LoyaltyAccountEditor`
// sheet: pick from the brand catalog (searchable), then member number, tier,
// balance, and tier-expiry. Opened with an `id` param it prefills and edits
// the existing account via the store's update action.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Button, Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { makeId } from '@/src/core/format';
import { LOYALTY_PROGRAMS, LoyaltyProgram, findProgram } from '@/src/features/vaults/loyaltyPrograms';
import { LOYALTY_META, useLoyalty } from '@/src/core/store/loyalty';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AddLoyaltyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accounts = useLoyalty((s) => s.accounts);
  const add = useLoyalty((s) => s.add);
  const update = useLoyalty((s) => s.update);
  const remove = useLoyalty((s) => s.remove);

  const existing = id ? accounts.find((a) => a.id === id) : undefined;

  const [programId, setProgramId] = useState<string | undefined>(
    () =>
      existing?.programId ??
      (existing
        ? LOYALTY_PROGRAMS.find((p) => p.name.toLowerCase() === existing.program.toLowerCase())?.id
        : undefined),
  );
  const [pickerOpen, setPickerOpen] = useState(existing == null);
  const [query, setQuery] = useState('');
  const [memberNumber, setMemberNumber] = useState(existing?.memberNumber ?? '');
  const [tier, setTier] = useState(existing?.tier ?? '');
  const [points, setPoints] = useState(existing?.points != null ? String(existing.points) : '');
  const [tierExpiry, setTierExpiry] = useState(existing?.tierExpiration ?? '');

  const program = findProgram(programId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LOYALTY_PROGRAMS;
    return LOYALTY_PROGRAMS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.tile.toLowerCase().includes(q),
    );
  }, [query]);

  const expiryValid = tierExpiry.trim() === '' || DATE_RE.test(tierExpiry.trim());
  const valid = program != null && memberNumber.trim().length > 0 && expiryValid;

  const save = () => {
    if (!valid || !program) return;
    const pts = parseInt(points.replace(/[^0-9]/g, ''), 10);
    const record = {
      id: existing?.id ?? makeId(),
      kind: program.kind,
      program: program.name,
      programId: program.id,
      memberNumber: memberNumber.trim(),
      tier: tier.trim() || undefined,
      points: isNaN(pts) ? undefined : pts,
      tierExpiration: tierExpiry.trim() || undefined,
    };
    if (existing) update(record);
    else add(record);
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Remove program?', existing.program, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          remove(existing.id);
          router.back();
        },
      },
    ]);
  };

  const selectProgram = (p: LoyaltyProgram) => {
    setProgramId(p.id);
    setPickerOpen(false);
    setQuery('');
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }} edges={['top']}>
      <ModalHeader title={existing ? 'Edit Program' : 'Add Program'} onSave={save} saveDisabled={!valid} />

      <Card style={{ gap: spacing.lg }}>
        {/* ── Program picker ───────────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Program</Text>

          {program && !pickerOpen ? (
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  borderColor: palette.lineStrong,
                  backgroundColor: palette.fillAccent,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <ProgramTile program={program} />
              <View style={{ flex: 1 }}>
                <Text style={type.sub}>{program.name}</Text>
                <Text style={[type.caption, { marginTop: 2 }]}>{LOYALTY_META[program.kind].label}</Text>
              </View>
              <Ionicons name="chevron-expand" size={16} color={palette.dim} />
            </Pressable>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Input
                placeholder="Search programs — Delta, Bonvoy, UR…"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={existing == null}
              />
              <View
                style={{
                  borderRadius: radii.control,
                  borderWidth: 1,
                  borderColor: palette.line,
                  overflow: 'hidden',
                }}
              >
                {filtered.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => selectProgram(p)}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 9,
                        borderBottomWidth: i === filtered.length - 1 ? 0 : 0.5,
                        borderBottomColor: palette.separator,
                        backgroundColor: p.id === programId ? palette.fillAccent : 'transparent',
                      },
                      pressed && { backgroundColor: 'rgba(59,158,240,0.08)' },
                    ]}
                  >
                    <ProgramTile program={p} small />
                    <View style={{ flex: 1 }}>
                      <Text style={type.body} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </View>
                    <Text style={[type.caption, { fontSize: 11 }]}>{LOYALTY_META[p.kind].label}</Text>
                    {p.id === programId ? (
                      <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
                    ) : null}
                  </Pressable>
                ))}
                {filtered.length === 0 ? (
                  <Text style={[type.bodyDim, { padding: spacing.md, textAlign: 'center' }]}>
                    No programs match “{query.trim()}”.
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* ── Member details ───────────────────────────────────────────── */}
        <Input
          label="Member number"
          value={memberNumber}
          onChangeText={setMemberNumber}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Tier (optional)" placeholder="Gold" value={tier} onChangeText={setTier} style={{ flex: 1 }} />
          <Input
            label="Balance (optional)"
            placeholder="42500"
            value={points}
            onChangeText={setPoints}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Input
            label="Tier expires (YYYY-MM-DD, optional)"
            placeholder="2027-01-31"
            value={tierExpiry}
            onChangeText={setTierExpiry}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          {!expiryValid ? (
            <Text style={[type.caption, { color: palette.bad }]}>Enter the date as YYYY-MM-DD, or leave blank.</Text>
          ) : null}
        </View>
      </Card>

      {existing ? (
        <Button
          title="Remove program"
          variant="danger"
          size="md"
          onPress={confirmDelete}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </Screen>
  );
}

function ProgramTile({ program, small }: { program: LoyaltyProgram; small?: boolean }) {
  const size = small ? 32 : 40;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: small ? 8 : 10,
        backgroundColor: program.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
      }}
    >
      <Text
        style={{
          fontFamily: MONO,
          fontSize: program.tile.length > 2 ? (small ? 8 : 10) : small ? 10 : 12,
          fontWeight: '700',
          color: '#FFFFFF',
        }}
      >
        {program.tile}
      </Text>
    </View>
  );
}
