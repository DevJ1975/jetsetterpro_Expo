import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card, CardAppear, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { CheckInCard } from '@/src/features/wallet/CheckInCard';
import { PassCard } from '@/src/features/wallet/PassCard';
import { WALLET_KIND_COLOR } from '@/src/features/wallet/WalletItemCard';
import { MONO, buildPassData, extractIdent, findWalletItem } from '@/src/features/wallet/passData';
import { formatDate, formatTime } from '@/src/core/format';
import { useCheckIn } from '@/src/core/store/checkin';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';
import { WALLET_META, WalletItem, useWallet } from '@/src/core/store/wallet';

// Boarding-pass detail — port of iOS `BoardingPassDetailView`: the
// Apple-Wallet-style pass with shimmer reveal, the online check-in card, and
// the (beta-stubbed) Add to Apple Wallet action. Non-flight documents get the
// generic hero + detail-rows layout of iOS `WalletItemDetailView`.

export default function PassScreen() {
  const router = useRouter();
  const { id, title, subtitle, code, location } = useLocalSearchParams<{
    id?: string;
    title?: string;
    subtitle?: string;
    code?: string;
    location?: string;
  }>();
  const trips = useTravel((s) => s.trips);
  const stored = useWallet((s) => s.items);

  const item = useMemo<WalletItem | undefined>(() => {
    if (id) return findWalletItem(trips, stored, id);
    // Legacy params-only deep link — degrade to a lightweight ticket.
    if (title)
      return { id: 'params', kind: 'ticket', title, subtitle, code, location };
    return undefined;
  }, [id, trips, stored, title, subtitle, code, location]);

  if (!item) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Pass" />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="wallet"
            title="Document not found"
            subtitle="This document is no longer in your wallet."
            actionLabel="Back to Wallet"
            onAction={() => router.replace('/wallet')}
          />
        </View>
      </Screen>
    );
  }

  return item.kind === 'boardingPass' ? (
    <BoardingPassBody item={item} />
  ) : (
    <GenericDocumentBody item={item} />
  );
}

// ── Boarding pass ────────────────────────────────────────────────────────────

function BoardingPassBody({ item }: { item: WalletItem }) {
  const passengerName = usePreferences((s) => s.name);
  // Seat confirmed via the check-in flow wins over whatever the item carried.
  const identGuess = (
    item.ident ??
    extractIdent(item.title) ??
    extractIdent(item.subtitle) ??
    'JS100'
  ).toUpperCase();
  const confirmedSeat = useCheckIn((s) => s.seats[identGuess]);
  const data = useMemo(
    () => buildPassData(item, { passengerName, seat: confirmedSeat }),
    [item, passengerName, confirmedSeat],
  );

  const onAppleWallet = () =>
    Alert.alert(
      'Coming to TestFlight',
      'Apple Wallet passes need the production signing certificate — the real PassKit hand-off ships with the TestFlight beta.',
    );

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={data.airline} title={data.ident} />

      {/* Spring-in reveal; the card paints its own shimmer sweep. */}
      <CardAppear>
        <PassCard data={data} shimmer />
      </CardAppear>

      {/* Online check-in (countdown + Check In Now) */}
      {item.date ? <CheckInCard ident={data.ident} dateISO={item.date} /> : null}

      {/* Add to Apple Wallet — iOS only; beta stub until PassKit signing */}
      {Platform.OS === 'ios' ? (
        <Pressable
          onPress={onAppleWallet}
          style={({ pressed }) => [styles.walletButton, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="wallet" size={18} color="#FFFFFF" />
          <Text style={styles.walletButtonLabel}>Add to Apple Wallet</Text>
        </Pressable>
      ) : null}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Reference pass — use the airline&apos;s official pass to board.
      </Text>
    </Screen>
  );
}

// ── Generic document (hotel / car / ticket / other) ─────────────────────────

function GenericDocumentBody({ item }: { item: WalletItem }) {
  const router = useRouter();
  const remove = useWallet((s) => s.remove);
  const meta = WALLET_META[item.kind];
  const color = WALLET_KIND_COLOR[item.kind];
  const isStored = !item.id.startsWith('derived-') && item.id !== 'params';

  const rows: [string, string][] = [];
  if (item.subtitle) rows.push(['Trip', item.subtitle]);
  if (item.date)
    rows.push([
      'Date',
      item.date.length > 10
        ? `${formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })} · ${formatTime(item.date)}`
        : formatDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' }),
    ]);
  if (item.endDate)
    rows.push(['Until', formatDate(item.endDate, { month: 'short', day: 'numeric', year: 'numeric' })]);
  if (item.location) rows.push(['Location', item.location]);
  if (item.code) rows.push(['Confirmation', item.code]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={meta.label} title={item.title} />

      {/* Hero card */}
      <CardAppear>
        <LinearGradient
          colors={[color, palette.bgDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroKicker}>{meta.label.toUpperCase()}</Text>
            <Text style={[type.heading, { color: '#FFFFFF' }]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <Ionicons name={meta.icon as never} size={44} color="rgba(255,255,255,0.35)" />
        </LinearGradient>
      </CardAppear>

      {/* Details */}
      {rows.length > 0 ? (
        <Card variant="glass" style={{ marginTop: spacing.lg }}>
          {rows.map(([label, value], i) => (
            <View
              key={label}
              style={[styles.detailRow, i < rows.length - 1 && styles.detailRowDivider]}
            >
              <Text style={type.bodyDim}>{label}</Text>
              <Text style={[type.body, { fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>
                {value}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Scannable code */}
      {item.code ? (
        <Card variant="glass" style={{ marginTop: spacing.lg, alignItems: 'center', gap: spacing.md }}>
          <View style={styles.qrWell}>
            <QRCode value={item.code} size={168} backgroundColor="#FFFFFF" color="#0A0F1E" />
          </View>
          <Text style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: palette.text }}>
            {item.code}
          </Text>
          <Text style={type.caption}>Present at entry or pick-up</Text>
        </Card>
      ) : null}

      {isStored ? (
        <Pressable
          onPress={() => {
            remove(item.id);
            router.back();
          }}
          style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="trash" size={15} color={palette.bad} />
          <Text style={[type.body, { color: palette.bad, fontWeight: '600' }]}>
            Remove from Wallet
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  walletButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  walletButtonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  hero: {
    borderRadius: 18,
    padding: spacing.lg,
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: 10,
  },
  detailRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.separator,
  },
  qrWell: { backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: 12 },
  removeButton: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.fillBad,
    borderRadius: 12,
    paddingVertical: 13,
  },
});
