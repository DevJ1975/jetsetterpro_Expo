import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { convertCurrency } from '@/src/core/api/exchange';
import { fetchWeather } from '@/src/core/api/weather';
import { matchCountry } from '@/src/core/data/countries';
import { formatDate } from '@/src/core/format';
import { usePreferences } from '@/src/core/store/preferences';
import { useOffline } from '@/src/core/store/offline';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { useWallet, passesFromTrips } from '@/src/core/store/wallet';

function Check({ label, ready }: { label: string; ready: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 }}>
      <Ionicons
        name={ready ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={ready ? palette.good : palette.faint}
      />
      <Text style={[type.body, !ready && { color: palette.faint }]}>{label}</Text>
    </View>
  );
}

export default function OfflineKitScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const storedPasses = useWallet((s) => s.items);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const prepared = useOffline((s) => s.prepared);
  const markPrepared = useOffline((s) => s.markPrepared);
  const [busy, setBusy] = useState(false);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );
  const country = matchCountry(trip?.destination);
  const passCount = useMemo(
    () => (trip ? passesFromTrips([trip]).length + storedPasses.length : 0),
    [trip, storedPasses],
  );
  const preparedAt = trip ? prepared[trip.id] : undefined;

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Offline Kit" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="cloud-offline" title="No trip yet" subtitle="Add a trip to prepare an offline kit." />
        </View>
      </Screen>
    );
  }

  const prepare = async () => {
    setBusy(true);
    // Warm the network-dependent caches so they're available in-flight.
    await Promise.all([
      fetchWeather(trip.destination),
      country ? convertCurrency(1, homeCurrency, country.currency) : Promise.resolve(),
    ]);
    markPrepared(trip.id);
    setBusy(false);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={trip.name} title="Offline Kit" />

      <Card variant="glass">
        <SectionLabel>Available offline</SectionLabel>
        <Check label={`Itinerary — ${trip.items.length} item(s)`} ready={trip.items.length > 0} />
        <Check label={`Travel wallet — ${passCount} pass(es)`} ready={passCount > 0} />
        <Check label={`Country essentials${country ? ` — ${country.name}` : ''}`} ready={!!country} />
        <Check label="Currency rates" ready={!!preparedAt} />
        <Check label="Destination weather" ready={!!preparedAt} />
      </Card>

      <Button
        title={busy ? 'Preparing…' : preparedAt ? 'Refresh offline kit' : 'Prepare offline kit'}
        size="lg"
        onPress={prepare}
        disabled={busy}
        style={{ marginTop: spacing.xl }}
      />

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        {preparedAt
          ? `Last prepared ${formatDate(preparedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Itinerary, wallet & essentials are always on-device.`
          : 'Caches rates & weather so your trip is ready in airplane mode.'}
      </Text>
    </Screen>
  );
}
