import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, CardAppear, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { WalletItemCard } from '@/src/features/wallet/WalletItemCard';
import { mergeWalletItems } from '@/src/features/wallet/passData';
import { useNow } from '@/src/core/useNow';
import { WalletItem, useWallet, walletStatus } from '@/src/core/store/wallet';
import { useTravel } from '@/src/core/store/travel';

// Travel Wallet — port of iOS `TravelWalletView`: ACTIVE NOW / UPCOMING / PAST
// sections, rich kind-tile rows with swipe-to-delete, and the transient
// success/error banner that auto-hides after 3s.

export default function WalletScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const removeItineraryItem = useTravel((s) => s.removeItineraryItem);
  const stored = useWallet((s) => s.items);
  const notice = useWallet((s) => s.notice);
  const setNotice = useWallet((s) => s.setNotice);
  const remove = useWallet((s) => s.remove);
  const now = useNow(60_000); // sections re-classify as time passes

  const items = useMemo(() => mergeWalletItems(trips, stored), [trips, stored]);

  const sections = useMemo(() => {
    const active: WalletItem[] = [];
    const upcoming: WalletItem[] = [];
    const past: WalletItem[] = [];
    for (const item of items) {
      const s = walletStatus(item, now);
      (s === 'active' ? active : s === 'upcoming' ? upcoming : past).push(item);
    }
    return { active, upcoming, past };
  }, [items, now]);

  // Banner auto-hides after 3 seconds (iOS Task.sleep(3) parity).
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const openItem = (p: WalletItem) =>
    router.push({ pathname: '/pass', params: { id: p.id } });

  const deleteItem = (p: WalletItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (p.id.startsWith('derived-')) {
      // Itinerary-derived documents live on the trip — remove them there.
      const itemId = p.id.slice('derived-'.length);
      const trip = trips.find((t) => t.items.some((i) => i.id === itemId));
      if (trip) removeItineraryItem(trip.id, itemId);
      setNotice(`"${p.title}" removed from wallet.`);
    } else {
      remove(p.id); // sets its own banner notice
    }
  };

  const renderRows = (list: WalletItem[], dimmed = false) =>
    list.map((p) => (
      <WalletItemCard
        key={p.id}
        item={p}
        status={walletStatus(p, now)}
        dimmed={dimmed}
        onPress={() => openItem(p)}
        onDelete={() => deleteItem(p)}
      />
    ));

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={`${items.length} ${items.length === 1 ? 'document' : 'documents'}`}
        title="Travel Wallet"
        right={
          <Pressable
            onPress={() => router.push('/add-wallet')}
            hitSlop={12}
            accessibilityLabel="Add to wallet"
          >
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.xl }}>
        {/* Success / error banner (auto-hides) */}
        {notice ? (
          <CardAppear style={{ marginBottom: spacing.lg }}>
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons
                  name={notice.error ? 'alert-circle' : 'checkmark-circle'}
                  size={20}
                  color={notice.error ? palette.bad : palette.good}
                />
                <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
                  {notice.text}
                </Text>
              </View>
            </Card>
          </CardAppear>
        ) : null}

        {items.length === 0 ? (
          <Card variant="glass">
            <EmptyState
              icon="wallet"
              title="Your wallet is empty"
              subtitle="Add boarding passes, hotel reservations, car rentals, and more — all in one place."
              actionLabel="Add Document"
              onAction={() => router.push('/add-wallet')}
            />
          </Card>
        ) : (
          <>
            {sections.active.length > 0 ? (
              <>
                <SectionLabel>Active now</SectionLabel>
                {renderRows(sections.active)}
              </>
            ) : null}

            {sections.upcoming.length > 0 ? (
              <>
                <SectionLabel style={sections.active.length > 0 ? { marginTop: spacing.lg } : undefined}>
                  Upcoming
                </SectionLabel>
                {renderRows(sections.upcoming)}
              </>
            ) : null}

            {sections.past.length > 0 ? (
              <>
                <SectionLabel style={{ marginTop: spacing.lg }}>Past</SectionLabel>
                {renderRows(sections.past, true)}
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
