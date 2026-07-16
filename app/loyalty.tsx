// Miles & Loyalty — RN port of iOS `LoyaltyVaultView.swift`: animated
// TOTAL MILES / TOTAL POINTS summary, kind-grouped program rows with brand
// tiles + tier capsules, tap-to-edit via the add-loyalty sheet.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { AnimatedCounter, Badge, Card, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { findProgram, maskMemberNumber, programTile } from '@/src/features/vaults/loyaltyPrograms';
import { LOYALTY_KINDS, LOYALTY_META, LoyaltyAccount, LoyaltyKind, useLoyalty } from '@/src/core/store/loyalty';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Tier expiring within the next 90 days (iOS `isExpiringSoon`). */
function tierExpiringSoon(iso?: string): boolean {
  if (!iso) return false;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days <= 90;
}

export default function LoyaltyScreen() {
  const router = useRouter();
  const accounts = useLoyalty((s) => s.accounts);

  const totalMiles = accounts
    .filter((a) => a.kind === 'airline')
    .reduce((sum, a) => sum + (a.points ?? 0), 0);
  const totalPoints = accounts
    .filter((a) => a.kind !== 'airline')
    .reduce((sum, a) => sum + (a.points ?? 0), 0);

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={`${accounts.length} ${accounts.length === 1 ? 'program' : 'programs'}`}
        title="Miles & Loyalty"
        right={
          <Pressable
            onPress={() => router.push('/add-loyalty')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Add program"
          >
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        {/* ── Summary card ─────────────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SummaryColumn label="Total Miles" icon="airplane" tint={palette.accent} value={totalMiles} />
            <View style={{ width: 0.5, height: 46, backgroundColor: palette.separator }} />
            <SummaryColumn label="Total Points" icon="bed" tint={palette.good} value={totalPoints} />
          </View>
        </Card>

        {accounts.length === 0 ? (
          <Card variant="glass">
            <EmptyState
              icon="ribbon"
              title="No loyalty accounts yet"
              subtitle="Track your airline miles, hotel points, and rental-car perks in one place."
              actionLabel="Add a program"
              onAction={() => router.push('/add-loyalty')}
            />
          </Card>
        ) : (
          (LOYALTY_KINDS as LoyaltyKind[]).map((kind) => {
            const rows = accounts.filter((a) => a.kind === kind);
            if (rows.length === 0) return null;
            return (
              <View key={kind}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
                  <Ionicons name={LOYALTY_META[kind].icon as never} size={12} color={palette.bright} />
                  <Text style={[type.overline, { color: palette.bright }]}>{LOYALTY_META[kind].label}</Text>
                  <View style={{ flex: 1, height: 0.5, backgroundColor: palette.line, marginLeft: spacing.sm }} />
                </View>
                <Card>
                  {rows.map((a, i) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      last={i === rows.length - 1}
                      onPress={() => router.push({ pathname: '/add-loyalty', params: { id: a.id } })}
                    />
                  ))}
                </Card>
              </View>
            );
          })
        )}

        {accounts.length > 0 ? (
          <Text style={[type.caption, { textAlign: 'center' }]}>Tap a program to edit it.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

// ── Summary column ───────────────────────────────────────────────────────────

function SummaryColumn({
  label,
  icon,
  tint,
  value,
}: {
  label: string;
  icon: string;
  tint: string;
  value: number;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon as never} size={11} color={tint} />
        <Text style={[type.overline, { fontSize: 9 }]}>{label}</Text>
      </View>
      <AnimatedCounter target={value} duration={1.4} style={type.stat} />
    </View>
  );
}

// ── Account row ──────────────────────────────────────────────────────────────

function AccountRow({
  account,
  last,
  onPress,
}: {
  account: LoyaltyAccount;
  last: boolean;
  onPress: () => void;
}) {
  const program = findProgram(account.programId);
  const brand = program ? { tile: program.tile, color: program.color } : programTile(account.program);
  const expiring = tierExpiringSoon(account.tierExpiration);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: 12,
          borderBottomWidth: last ? 0 : 0.5,
          borderBottomColor: palette.line,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* Brand tile */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: brand.color,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
        }}
      >
        <Text style={{ fontFamily: MONO, fontSize: brand.tile.length > 2 ? 11 : 13, fontWeight: '700', color: '#FFFFFF' }}>
          {brand.tile}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.sub, { fontSize: 15 }]} numberOfLines={1}>
          {program?.name ?? account.program}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
          {account.tier ? (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: radii.pill,
                backgroundColor: `${brand.color}33`,
                borderWidth: 1,
                borderColor: `${brand.color}66`,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: '#FFFFFF' }}>
                {account.tier.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: MONO, fontSize: 11, color: palette.dim }} numberOfLines={1}>
            #{maskMemberNumber(account.memberNumber)}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {account.points != null ? (
          <Text style={{ fontFamily: MONO, fontSize: 15, color: palette.text }}>
            {account.points.toLocaleString('en-US')}
          </Text>
        ) : null}
        {expiring ? <Badge tone="warn" label="Expiring" /> : null}
      </View>
    </Pressable>
  );
}
