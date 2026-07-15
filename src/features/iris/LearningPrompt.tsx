import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { IrisOrb } from './components';
import { usePreferences } from '@/src/core/store/preferences';

// First-run opt-in for the learning layer — port of iOS
// IRISLearningPromptView. Shown once (hasSeenIrisLearningPrompt): allowing
// turns on the master switch + every source; declining turns the master off.
// Either way the card never reappears.

export function LearningPrompt() {
  const seen = usePreferences((s) => s.hasSeenIrisLearningPrompt);
  const setIrisLearning = usePreferences((s) => s.setIrisLearning);
  const markSeen = usePreferences((s) => s.markIrisLearningPromptSeen);

  if (seen) return null;

  const allow = () => {
    setIrisLearning({ master: true, checkIns: true, receipts: true, trips: true });
    markSeen();
  };

  const decline = () => {
    setIrisLearning({ master: false });
    markSeen();
  };

  return (
    <Card variant="glass" style={{ marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IrisOrb size={20} />
        <Text style={[type.overline, { color: palette.bright }]}>IRIS · Learning</Text>
      </View>
      <Text style={type.sub}>IRIS learns from your travel</Text>
      <Text style={type.bodyDim}>
        With your permission, IRIS notices the seats you pick, the airlines you fly, and the places
        you go — to personalize every trip. It stays on your device, and you can turn any source
        off (or wipe everything) in Settings.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
        <Button title="Allow" size="md" onPress={allow} />
        <Button title="Not now" variant="ghost" size="md" onPress={decline} />
      </View>
    </Card>
  );
}
