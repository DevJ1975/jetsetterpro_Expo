import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IrisOrb } from '@/src/features/iris/components';
import { evaluateSuggestions } from '@/src/core/ai/iris/triggers';
import { useCheckIn } from '@/src/core/store/checkin';
import { useIris } from '@/src/core/store/iris';
import { useIrisSuggestions } from '@/src/core/store/irisSuggestions';
import { useTravel } from '@/src/core/store/travel';

const WATCHES = [
  'Check-in windows opening',
  'When to leave for the airport',
  'Packing & visa reminders before trips',
  'Weather at your destination',
  'Budget pacing while traveling',
];

export default function IntelligenceScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const dismissed = useIrisSuggestions((s) => s.dismissed);
  const dismiss = useIrisSuggestions((s) => s.dismiss);
  const isCheckedIn = useCheckIn((s) => s.isCheckedIn);
  const checkedIn = useCheckIn((s) => s.checkedIn);
  const queuePrompt = useIris((s) => s.queuePrompt);

  const active = useMemo(
    () => evaluateSuggestions(trips, isCheckedIn, new Date()).filter((s) => !dismissed.includes(s.dismissalKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips, dismissed, checkedIn],
  );

  const talk = (prompt: string) => {
    queuePrompt(prompt);
    router.push('/iris');
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="What IRIS is watching" title="Proactive Intelligence" />

      {active.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="bulb"
            title="Nothing needs you right now"
            subtitle="IRIS surfaces timely nudges here as your trips approach."
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {active.map((s) => (
            <Card key={s.dismissalKey} variant="glass" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IrisOrb size={18} />
                <Text style={[type.overline, { color: palette.bright }]}>IRIS · Suggestion</Text>
              </View>
              <Text style={type.sub}>{s.title}</Text>
              <Text style={type.bodyDim}>{s.body}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                <Button title="Talk to IRIS" size="md" onPress={() => talk(s.promptToIRIS)} />
                <Button title="Dismiss" variant="ghost" size="md" onPress={() => dismiss(s.dismissalKey)} />
              </View>
            </Card>
          ))}
        </View>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>What IRIS watches</SectionLabel>
        {WATCHES.map((w) => (
          <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.bright }} />
            <Text style={type.body}>{w}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
