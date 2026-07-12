import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { formatDate } from '@/src/core/format';
import {
  CATEGORY_DISPLAY,
  CATEGORY_ICON,
  MemoryCategory,
  effectiveConfidence,
  useIrisMemory,
} from '@/src/core/store/irisMemory';

function dotColor(conf: number): string {
  if (conf >= 0.85) return palette.good;
  if (conf >= 0.6) return palette.accent;
  return palette.faint;
}

export default function IrisMemoryScreen() {
  const preferences = useIrisMemory((s) => s.preferences);
  const remove = useIrisMemory((s) => s.remove);
  const forgetEverything = useIrisMemory((s) => s.forgetEverything);

  const categories = Object.keys(CATEGORY_DISPLAY) as MemoryCategory[];
  const now = Date.now();

  const wipe = () => {
    Alert.alert("Wipe IRIS's memory?", 'This forgets every saved preference. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget everything', style: 'destructive', onPress: forgetEverything },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="On-device & private" title="What IRIS Remembers" />

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <Text style={type.bodyDim}>
            IRIS remembers your travel preferences on this device only — never shared with third
            parties. Delete anything, anytime.
          </Text>
        </Card>

        {preferences.length === 0 ? (
          <Card>
            <EmptyState
              icon="bookmark"
              title="Nothing saved yet"
              subtitle='Tell IRIS things like "I prefer aisle seats" and they’ll show up here.'
            />
          </Card>
        ) : (
          categories.map((cat) => {
            const rows = preferences.filter((p) => p.category === cat);
            if (rows.length === 0) return null;
            return (
              <Card key={cat} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Ionicons name={CATEGORY_ICON[cat] as never} size={16} color={palette.accent} />
                  <Text style={[type.overline, { color: palette.bright }]}>{CATEGORY_DISPLAY[cat]}</Text>
                </View>
                {rows.map((p, i) => (
                  <View
                    key={p.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingVertical: 8,
                      borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
                      borderBottomColor: palette.line,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: dotColor(effectiveConfidence(p, now)),
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>{p.value}</Text>
                      <Text style={[type.caption, { marginTop: 2 }]}>Saved {formatDate(p.createdAt)}</Text>
                    </View>
                    <Pressable onPress={() => remove(p.id)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={palette.faint} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            );
          })
        )}

        {preferences.length > 0 ? (
          <Button title="Forget everything" variant="danger" size="md" onPress={wipe} />
        ) : null}
      </View>
    </Screen>
  );
}
