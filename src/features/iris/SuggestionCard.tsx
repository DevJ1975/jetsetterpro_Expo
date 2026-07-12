import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { IrisOrb } from './components';
import { evaluateSuggestions } from '@/src/core/ai/iris/triggers';
import { useCheckIn } from '@/src/core/store/checkin';
import { useIris } from '@/src/core/store/iris';
import { useIrisSuggestions } from '@/src/core/store/irisSuggestions';
import { useTravel } from '@/src/core/store/travel';

/** The top proactive IRIS suggestion for the current context (self-hides when none). */
export function IrisSuggestionCard() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const dismissed = useIrisSuggestions((s) => s.dismissed);
  const dismiss = useIrisSuggestions((s) => s.dismiss);
  const isCheckedIn = useCheckIn((s) => s.isCheckedIn);
  const checkedIn = useCheckIn((s) => s.checkedIn);
  const queuePrompt = useIris((s) => s.queuePrompt);

  const suggestion = useMemo(() => {
    const all = evaluateSuggestions(trips, isCheckedIn, new Date());
    return all.find((s) => !dismissed.includes(s.dismissalKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, dismissed, checkedIn]);

  if (!suggestion) return null;

  const talk = () => {
    queuePrompt(suggestion.promptToIRIS);
    router.navigate('/iris');
  };

  return (
    <Card variant="glass" style={{ marginBottom: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IrisOrb size={20} />
        <Text style={[type.overline, { color: palette.bright }]}>IRIS · Suggestion</Text>
      </View>
      <Text style={type.sub}>{suggestion.title}</Text>
      <Text style={type.bodyDim}>{suggestion.body}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
        <Button title="Talk to IRIS" size="md" onPress={talk} />
        <Button title="Not now" variant="ghost" size="md" onPress={() => dismiss(suggestion.dismissalKey)} />
      </View>
    </Card>
  );
}
