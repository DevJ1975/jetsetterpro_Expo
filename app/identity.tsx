import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Card, ListRow, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate } from '@/src/core/format';
import { IDENTITY_META, useIdentity } from '@/src/core/store/identity';

export default function IdentityScreen() {
  const router = useRouter();
  const credentials = useIdentity((s) => s.credentials);
  const remove = useIdentity((s) => s.remove);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="Digital ID · CLEAR · PreCheck · Global Entry"
        title="Identity & Trusted Traveler"
        right={
          <Pressable onPress={() => router.push('/add-identity')} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      {credentials.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="id-card"
            title="No credentials yet"
            subtitle="Store your Known Traveler Number, Global Entry, CLEAR, and Digital ID for quick access at the airport."
            actionLabel="Add a credential"
            onAction={() => router.push('/add-identity')}
          />
        </Card>
      ) : (
        <Card>
          {credentials.map((c, i) => (
            <ListRow
              key={c.id}
              last={i === credentials.length - 1}
              icon={<IconWell name={IDENTITY_META[c.kind].icon} size={18} />}
              title={IDENTITY_META[c.kind].label}
              subtitle={c.expiration ? `Exp ${formatDate(c.expiration)}` : undefined}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={type.sub}>{c.number}</Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Remove credential?', IDENTITY_META[c.kind].label, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => remove(c.id) },
                      ])
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={palette.faint} />
                  </Pressable>
                </View>
              }
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
