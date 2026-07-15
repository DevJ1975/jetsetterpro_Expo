import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import {
  DerivedKey,
  DerivedPref,
  deriveProfile,
  useTravelProfile,
} from '@/src/core/store/travelProfile';

// "What IRIS Has Learned" — port of iOS Features/IRIS/IRISLearnedProfileView:
// the transparency screen for the learning layer. Shows exactly what IRIS has
// inferred from the traveler's own activity, and lets them forget any of it.

const ROW_ICON: Record<DerivedKey, string> = {
  preferredAirline: 'airplane',
  usualSeat: 'person',
  homeAirport: 'home',
  typicalTripLength: 'calendar',
  spendingPattern: 'card',
};

function ConfidenceDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i <= level ? palette.accent : palette.elevated2,
          }}
        />
      ))}
    </View>
  );
}

export default function IrisLearnedProfileScreen() {
  const signals = useTravelProfile((s) => s.signals);
  const forgetKinds = useTravelProfile((s) => s.forgetKinds);
  const resetAll = useTravelProfile((s) => s.resetAll);

  const derived = useMemo(() => deriveProfile(signals), [signals]);

  const confirmForget = (row: DerivedPref) =>
    Alert.alert(`Forget "${row.label.toLowerCase()}"?`, 'IRIS drops the observations behind this and re-learns only if it happens again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => forgetKinds(row.kinds) },
    ]);

  const confirmReset = () =>
    Alert.alert('Reset all learning?', 'This clears the inferred profile and its signals. Your trips, expenses, and saved IRIS preferences are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetAll },
    ]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="On-device learning" title="What IRIS Has Learned" />

      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <Text style={type.bodyDim}>
          IRIS builds this on your device from the seats you pick, flights you take, and expenses
          you log. It&apos;s never shared — forget any of it, anytime.
        </Text>
      </Card>

      {derived.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title="Nothing learned yet"
            subtitle="As you set preferences, take trips, and log expenses, IRIS will start to recognize your patterns here."
          />
        </Card>
      ) : (
        <>
          <View style={{ gap: spacing.md }}>
            {derived.map((row) => (
              <Card key={row.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <IconWell name={ROW_ICON[row.key]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type.caption}>{row.label}</Text>
                    <Text style={[type.sub, { marginTop: 2 }]} numberOfLines={1}>
                      {row.value}
                    </Text>
                    <Text style={[type.caption, { color: palette.faint, marginTop: 2 }]}>{row.detail}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
                    <ConfidenceDots level={row.confidence} />
                    <Pressable
                      onPress={() => confirmForget(row)}
                      hitSlop={8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="trash-outline" size={13} color={palette.bad} />
                      <Text style={[type.caption, { color: palette.bad, fontWeight: '600' }]}>Forget this</Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <Button
            title="Reset all learning"
            variant="danger"
            size="md"
            onPress={confirmReset}
            style={{ marginTop: spacing.xl }}
          />
        </>
      )}
    </Screen>
  );
}
