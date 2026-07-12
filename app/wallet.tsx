import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Card, ListRow, palette, spacing } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate } from '@/src/core/format';
import { WALLET_META, WalletItem, passesFromTrips, useWallet } from '@/src/core/store/wallet';
import { useTravel } from '@/src/core/store/travel';

export default function WalletScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const stored = useWallet((s) => s.items);

  const passes = useMemo(() => {
    const all = [...passesFromTrips(trips), ...stored];
    return all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [trips, stored]);

  const openPass = (p: WalletItem) =>
    router.push({
      pathname: '/pass',
      params: { title: p.title, subtitle: p.subtitle ?? '', code: p.code ?? '', location: p.location ?? '' },
    });

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={`${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}`}
        title="Travel Wallet"
        right={
          <Pressable onPress={() => router.push('/add-wallet')} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: spacing.xl }}>
      {passes.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="wallet"
            title="Your wallet is empty"
            subtitle="Boarding passes and hotel confirmations appear here from your itinerary — or add a ticket."
            actionLabel="Add a pass"
            onAction={() => router.push('/add-wallet')}
          />
        </Card>
      ) : (
        <Card>
          {passes.map((p, i) => (
            <ListRow
              key={p.id}
              last={i === passes.length - 1}
              icon={<IconWell name={WALLET_META[p.kind].icon} size={18} />}
              title={p.title}
              subtitle={[p.subtitle, p.date ? formatDate(p.date) : undefined].filter(Boolean).join(' · ')}
              right={<Badge tone="accent" label={WALLET_META[p.kind].label} />}
              onPress={() => openPass(p)}
            />
          ))}
        </Card>
      )}
      </View>
    </Screen>
  );
}
