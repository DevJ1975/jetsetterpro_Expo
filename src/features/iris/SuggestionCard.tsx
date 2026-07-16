import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button, palette, radii, spacing, type } from '@/src/ui';
import { IRIS_SPECTRUM, IrisOrb } from './components';
import { evaluateSuggestions } from '@/src/core/ai/iris/triggers';
import { useNow } from '@/src/core/useNow';
import { useCheckIn } from '@/src/core/store/checkin';
import { useIris } from '@/src/core/store/iris';
import { useIrisSuggestions } from '@/src/core/store/irisSuggestions';
import { useTravel } from '@/src/core/store/travel';

// The iOS card (IRISSuggestionCardView.swift) frames itself in the IRIS
// rainbow: a 1px spectrum border at half opacity around a near-black body,
// with the rainbow orb leading the header.
const BORDER_SPECTRUM = IRIS_SPECTRUM.map((c) => `${c}80`) as unknown as readonly [
  string,
  string,
  ...string[],
];

/** The top proactive IRIS suggestion for the current context (self-hides when none). */
export function IrisSuggestionCard() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const dismissed = useIrisSuggestions((s) => s.dismissed);
  const dismiss = useIrisSuggestions((s) => s.dismiss);
  const isCheckedIn = useCheckIn((s) => s.isCheckedIn);
  const checkedIn = useCheckIn((s) => s.checkedIn);
  const queuePrompt = useIris((s) => s.queuePrompt);
  const now = useNow(60_000); // re-evaluate time-gated suggestions each minute

  const suggestion = useMemo(() => {
    const all = evaluateSuggestions(trips, isCheckedIn, new Date(now));
    return all.find((s) => !dismissed.includes(s.dismissalKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, dismissed, checkedIn, now]);

  if (!suggestion) return null;

  const talk = () => {
    queuePrompt(suggestion.promptToIRIS);
    router.navigate('/iris');
  };

  return (
    <LinearGradient
      colors={BORDER_SPECTRUM}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: radii.card, padding: 1, marginBottom: spacing.lg }}
    >
      <View
        style={{
          borderRadius: radii.card - 1,
          backgroundColor: '#0D0F17',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
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
      </View>
    </LinearGradient>
  );
}
