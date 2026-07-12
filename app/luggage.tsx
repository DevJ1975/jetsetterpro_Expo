import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { relativeDayLabel } from '@/src/core/format';
import { BAG_STATUSES, BAG_STATUS_META, useLuggage } from '@/src/core/store/luggage';

export default function LuggageScreen() {
  const router = useRouter();
  const bags = useLuggage((s) => s.bags);
  const setStatus = useLuggage((s) => s.setStatus);
  const remove = useLuggage((s) => s.remove);

  const cycleStatus = (id: string, current: string) => {
    const idx = BAG_STATUSES.indexOf(current as never);
    setStatus(id, BAG_STATUSES[(idx + 1) % BAG_STATUSES.length]);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="AirTag & WorldTracer"
        title="Luggage Tracker"
        right={
          <Pressable onPress={() => router.push('/add-bag')} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      {bags.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="bag-handle"
            title="No bags tracked"
            subtitle="Add a checked bag by tag number to keep an eye on it through your journey."
            actionLabel="Add a bag"
            onAction={() => router.push('/add-bag')}
          />
        </Card>
      ) : (
        <Card>
          <SectionLabel>Your bags</SectionLabel>
          {bags.map((b, i) => {
            const meta = BAG_STATUS_META[b.status];
            return (
              <View
                key={b.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: 12,
                  borderBottomWidth: i === bags.length - 1 ? 0 : 0.5,
                  borderBottomColor: palette.line,
                }}
              >
                <IconWell name={meta.icon} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={type.sub}>{b.label}</Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>
                    {[b.airline, b.tagNumber ? `#${b.tagNumber}` : undefined, `Updated ${relativeDayLabel(b.updatedAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable onPress={() => cycleStatus(b.id, b.status)} hitSlop={6}>
                  <Badge tone={meta.tone} label={meta.label} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Remove bag?', b.label, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => remove(b.id) },
                    ])
                  }
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={palette.faint} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Tap a status to update it. Live carrier tracking (SITA WorldTracer) + AirTag location connect
        in a later update.
      </Text>
    </Screen>
  );
}
