import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate, relativeDayLabel } from '@/src/core/format';
import { LOYALTY_KINDS, LOYALTY_META, LoyaltyKind, useLoyalty } from '@/src/core/store/loyalty';

function expiringSoon(iso?: string): boolean {
  if (!iso) return false;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
}

export default function LoyaltyScreen() {
  const router = useRouter();
  const accounts = useLoyalty((s) => s.accounts);
  const remove = useLoyalty((s) => s.remove);

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={`${accounts.length} ${accounts.length === 1 ? 'program' : 'programs'}`}
        title="Miles & Loyalty"
        right={
          <Pressable onPress={() => router.push('/add-loyalty')} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.xl }}>
        {accounts.length === 0 ? (
          <Card variant="glass">
            <EmptyState
              icon="ribbon"
              title="No programs yet"
              subtitle="Add your airline, hotel, and car-rental loyalty accounts to track points and status."
              actionLabel="Add a program"
              onAction={() => router.push('/add-loyalty')}
            />
          </Card>
        ) : (
          (LOYALTY_KINDS as LoyaltyKind[]).map((kind) => {
            const rows = accounts.filter((a) => a.kind === kind);
            if (rows.length === 0) return null;
            return (
              <Card key={kind} style={{ marginBottom: spacing.lg }}>
                <SectionLabel>{LOYALTY_META[kind].label}</SectionLabel>
                {rows.map((a, i) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingVertical: 10,
                      borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
                      borderBottomColor: palette.line,
                    }}
                  >
                    <IconWell name={LOYALTY_META[kind].icon} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.sub}>{a.program}</Text>
                      <Text style={[type.caption, { marginTop: 2 }]}>#{a.memberNumber}</Text>
                      {a.tierExpiration ? (
                        <Text
                          style={[
                            type.caption,
                            { marginTop: 2, color: expiringSoon(a.tierExpiration) ? palette.warn : palette.faint },
                          ]}
                        >
                          {a.tier ? `${a.tier} · ` : ''}
                          {expiringSoon(a.tierExpiration)
                            ? `Expires ${relativeDayLabel(a.tierExpiration)}`
                            : `Valid to ${formatDate(a.tierExpiration)}`}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {a.points != null ? (
                        <Text style={type.sub}>{a.points.toLocaleString()}</Text>
                      ) : null}
                      {a.tier && !a.tierExpiration ? <Badge tone="accent" label={a.tier} /> : null}
                      <Pressable
                        onPress={() =>
                          Alert.alert('Remove program?', a.program, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => remove(a.id) },
                          ])
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={palette.faint} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}
