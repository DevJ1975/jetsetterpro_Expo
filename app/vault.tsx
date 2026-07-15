import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { authenticate, isBiometricAvailable } from '@/src/core/services/biometric';
import { formatDate } from '@/src/core/format';
import { DOC_COLORS, daysUntil, expiryUrgency, urgencyColor } from '@/src/features/vaults/docStyle';
import { DOC_META, VaultDoc, getDocNumber, useVault } from '@/src/core/store/vault';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function VaultScreen() {
  const router = useRouter();
  const docs = useVault((s) => s.docs);
  const remove = useVault((s) => s.remove);

  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  // null until the async capability check lands — banner only on a hard false.
  const [biometricsEnrolled, setBiometricsEnrolled] = useState<boolean | null>(null);

  const tryUnlock = useCallback(async () => {
    const ok = await authenticate('Unlock your Document Vault');
    setUnlocked(ok);
  }, []);

  // Auto-prompt Face ID when the vault opens. `setUnlocked` fires only after the
  // async `authenticate()` resolves — not synchronously — so this is a legitimate
  // mount side effect, not the cascading-render pattern the rule guards against.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tryUnlock();
    void isBiometricAvailable().then(setBiometricsEnrolled);
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

  const confirmRemove = (d: VaultDoc) =>
    Alert.alert('Remove document?', d.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(d.id) },
    ]);

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
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          {!unlocked ? (
            <>
              <Card variant="glass">
                <EmptyState
                  icon="lock-closed"
                  title="Vault locked"
                  subtitle="Your passport, visa, and insurance numbers are encrypted on this device."
                  actionLabel="Unlock"
                  onAction={tryUnlock}
                />
              </Card>
              {/* iOS parity: Emergency Mode stays reachable from the auth gate. */}
              <EmergencyBanner onPress={() => router.push('/emergency')} />
            </>
          ) : (
            <>
              {biometricsEnrolled === false ? <SecurityAdvisoryBanner /> : null}

              <EmergencyBanner onPress={() => router.push('/emergency')} />

              {docs.length === 0 ? (
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
                docs.map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    revealedNumber={revealed[d.id]}
                    onToggleReveal={() => reveal(d.id)}
                    onRemove={() => confirmRemove(d)}
                  />
                ))
              )}
            </>
          )}

          {unlocked ? (
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              Numbers are stored in the device keychain and revealed only after you unlock.
            </Text>
          ) : (
            <Button title="Unlock vault" size="md" onPress={tryUnlock} style={{ marginTop: spacing.sm }} />
          )}
        </View>
      </PremiumGate>
    </Screen>
  );
}

// ── Document card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  revealedNumber,
  onToggleReveal,
  onRemove,
}: {
  doc: VaultDoc;
  revealedNumber?: string;
  onToggleReveal: () => void;
  onRemove: () => void;
}) {
  const color = DOC_COLORS[doc.type];
  const days = doc.expiry ? daysUntil(doc.expiry) : null;
  const urgency = days != null ? expiryUrgency(days) : null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {/* Colored type tile */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: `${color}1F`,
            borderWidth: 1,
            borderColor: `${color}33`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={DOC_META[doc.type].icon as never} size={22} color={color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.sub} numberOfLines={1}>
            {doc.name}
          </Text>
          <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
            {DOC_META[doc.type].label}
            {doc.hasNumber ? '  ·  ' : ''}
            {doc.hasNumber ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: revealedNumber ? palette.text : palette.dim }}>
                {revealedNumber ?? '•••• ••••'}
              </Text>
            ) : null}
          </Text>

          {doc.expiry && days != null && urgency ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
              <Text style={[type.caption, { color: urgencyColor(urgency) }]} numberOfLines={1}>
                {days <= 0
                  ? `Expired ${formatDate(doc.expiry, { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : `Expires ${formatDate(doc.expiry, { month: 'short', day: 'numeric', year: 'numeric' })} · ${days}d left`}
              </Text>
              {days <= 0 ? <Badge tone="bad" label="Expired" /> : null}
            </View>
          ) : null}
        </View>

        {/* Photo thumb + actions */}
        <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {doc.photoUri ? (
              <Image
                source={{ uri: doc.photoUri }}
                style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: palette.surface }}
                contentFit="cover"
              />
            ) : null}
            {doc.hasNumber ? (
              <Pressable onPress={onToggleReveal} hitSlop={8}>
                <Ionicons name={revealedNumber ? 'eye-off' : 'eye'} size={18} color={palette.bright} />
              </Pressable>
            ) : null}
            <Pressable onPress={onRemove} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={palette.faint} />
            </Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ── Banners ──────────────────────────────────────────────────────────────────

/** Red-tinted Emergency Mode entry — passport, insurance & contacts offline. */
function EmergencyBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radii.card,
          backgroundColor: 'rgba(255,92,92,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255,92,92,0.25)',
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name="medical" size={22} color={palette.bad} />
      <View style={{ flex: 1 }}>
        <Text style={[type.sub, { fontSize: 15 }]}>Emergency Mode</Text>
        <Text style={[type.caption, { marginTop: 2 }]}>
          Passport, insurance & contacts — available offline
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.dim} />
    </Pressable>
  );
}

/** Non-blocking advisory shown when no biometric is enrolled on this device. */
function SecurityAdvisoryBanner() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.card,
        backgroundColor: palette.fillWarn,
        borderWidth: 1,
        borderColor: 'rgba(232,160,32,0.25)',
      }}
    >
      <Ionicons name="warning" size={22} color={palette.warn} />
      <View style={{ flex: 1 }}>
        <Text style={[type.sub, { fontSize: 15 }]}>No biometrics enrolled</Text>
        <Text style={[type.caption, { marginTop: 2 }]}>
          Face ID / fingerprint isn&apos;t set up, so the vault falls back to your device passcode.
          Enroll biometrics in Settings for the strongest protection.
        </Text>
      </View>
    </View>
  );
}
