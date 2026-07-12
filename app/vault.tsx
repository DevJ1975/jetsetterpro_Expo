import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, ListRow, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { authenticate } from '@/src/core/services/biometric';
import { formatDate } from '@/src/core/format';
import { DOC_META, getDocNumber, useVault } from '@/src/core/store/vault';

export default function VaultScreen() {
  const router = useRouter();
  const docs = useVault((s) => s.docs);
  const remove = useVault((s) => s.remove);

  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const tryUnlock = useCallback(async () => {
    const ok = await authenticate('Unlock your Document Vault');
    setUnlocked(ok);
  }, []);

  useEffect(() => {
    void tryUnlock();
  }, [tryUnlock]);

  const reveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
      return;
    }
    const value = await getDocNumber(id);
    if (value) setRevealed((r) => ({ ...r, [id]: value }));
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="Encrypted · on-device"
        title="Document Vault"
        right={
          unlocked ? (
            <Pressable onPress={() => router.push('/add-document')} hitSlop={12}>
              <Ionicons name="add-circle" size={30} color={palette.accent} />
            </Pressable>
          ) : undefined
        }
      />

      <PremiumGate feature="Document Vault">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {!unlocked ? (
            <Card variant="glass">
              <EmptyState
                icon="lock-closed"
                title="Vault locked"
                subtitle="Your passport, visa, and insurance numbers are encrypted on this device."
                actionLabel="Unlock"
                onAction={tryUnlock}
              />
            </Card>
          ) : docs.length === 0 ? (
            <Card variant="glass">
              <EmptyState
                icon="document-text"
                title="No documents yet"
                subtitle="Add a passport, visa, or insurance card — numbers are stored encrypted."
                actionLabel="Add a document"
                onAction={() => router.push('/add-document')}
              />
            </Card>
          ) : (
            <Card>
              <SectionLabel>Documents</SectionLabel>
              {docs.map((d, i) => (
                <ListRow
                  key={d.id}
                  last={i === docs.length - 1}
                  icon={<IconWell name={DOC_META[d.type].icon} size={18} />}
                  title={d.name}
                  subtitle={[
                    DOC_META[d.type].label,
                    d.expiry ? `Exp ${formatDate(d.expiry)}` : undefined,
                    d.hasNumber ? (revealed[d.id] ?? '•••• ••••') : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      {d.hasNumber ? (
                        <Pressable onPress={() => reveal(d.id)} hitSlop={8}>
                          <Ionicons
                            name={revealed[d.id] ? 'eye-off' : 'eye'}
                            size={18}
                            color={palette.bright}
                          />
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          Alert.alert('Remove document?', d.name, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => remove(d.id) },
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

          {unlocked ? (
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
              Numbers are stored in the device keychain and revealed only after you unlock.
            </Text>
          ) : null}

          {!unlocked ? (
            <Button
              title="Unlock vault"
              size="md"
              onPress={tryUnlock}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </View>
      </PremiumGate>
    </Screen>
  );
}
