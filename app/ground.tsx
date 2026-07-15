import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Input,
  SectionLabel,
  StatusDot,
  palette,
  radii,
  spacing,
  type,
} from '@/src/ui';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Screen } from '@/src/features/common/Screen';
import { parseRoute } from '@/src/core/flightPhase';
import { activeOrNextTrip, nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import {
  LatLngLite,
  RideEstimate,
  RideProvider,
  buildEstimates,
  providerName,
} from '@/src/features/ground/estimates';

/** "123 Main St, City" from an expo-location reverse-geocode result. */
function formatAddress(a: Location.LocationGeocodedAddress, coords: LatLngLite): string {
  const street =
    a.streetNumber && a.street ? `${a.streetNumber} ${a.street}` : (a.street ?? a.name);
  const line = [street, a.city ?? a.region].filter(Boolean).join(', ');
  return line || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

function ProviderTile({ provider, size = 40 }: { provider: RideProvider; size?: number }) {
  const uber = provider === 'uber';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: uber ? '#000000' : '#FF00BF',
        borderWidth: uber ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: '800' }}>
        {uber ? 'U' : 'L'}
      </Text>
    </View>
  );
}

export default function GroundTransportScreen() {
  const trips = useTravel((s) => s.trips);
  const insets = useSafeAreaInsets();

  // Dropoff prefill: active trip destination, else next-flight origin airport.
  const suggestedDropoff = useMemo(() => {
    const trip = activeOrNextTrip(trips);
    if (trip?.destination) return trip.destination;
    const flight = nextUpcomingFlight(trips);
    const origin = flight ? parseRoute(flight.item.title).origin : '';
    return origin ? `${origin} Airport` : '';
  }, [trips]);

  const [pickup, setPickup] = useState('');
  const [pickupCoord, setPickupCoord] = useState<LatLngLite | null>(null);
  const [locating, setLocating] = useState(false);
  const [dropoff, setDropoff] = useState(suggestedDropoff);

  const [estimates, setEstimates] = useState<RideEstimate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RideEstimate | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);

  // ── Pickup detection ───────────────────────────────────────────────────────
  const detect = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setPickup('Location unavailable');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setPickupCoord(coords);
      try {
        const places = await Location.reverseGeocodeAsync(coords);
        setPickup(
          places[0]
            ? formatAddress(places[0], coords)
            : `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        );
      } catch {
        setPickup(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      }
    } catch {
      setPickup('Location unavailable');
    } finally {
      setLocating(false);
    }
  };

  // ── Estimates (heuristic, deterministic — see estimates.ts) ────────────────
  const getEstimates = () => {
    if (!dropoff.trim() || loading) return;
    const rows = buildEstimates(pickupCoord, dropoff);
    setLoading(true);
    setEstimates(null);
    // Brief pause so the refresh reads as a fetch (parity with iOS loading state).
    setTimeout(() => {
      setEstimates(rows);
      setLoading(false);
    }, 450);
  };

  // ── Provider hand-off ──────────────────────────────────────────────────────
  const openProvider = async (est: RideEstimate) => {
    const enc = encodeURIComponent(dropoff.trim());
    const pickupQS = pickupCoord
      ? `&pickup[latitude]=${pickupCoord.latitude}&pickup[longitude]=${pickupCoord.longitude}`
      : '';
    const scheme =
      est.provider === 'uber'
        ? `uber://?action=setPickup${pickupQS || '&pickup=my_location'}&dropoff[formatted_address]=${enc}`
        : `lyft://ridetype?id=lyft${pickupQS}&destination[address]=${enc}`;
    const fallback =
      est.provider === 'uber'
        ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${enc}`
        : `https://lyft.com/ride?destination=${enc}`;

    const canDeepLink = await Linking.canOpenURL(scheme).catch(() => false);
    const url = canDeepLink ? scheme : fallback;
    try {
      await Linking.openURL(url);
    } catch {
      if (url === fallback) return; // nothing else to try
      try {
        await Linking.openURL(fallback);
      } catch {
        return;
      }
    }
    setSelected(null);
    setHandoff(providerName(est.provider));
  };

  // Success banner auto-dismisses.
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => setHandoff(null), 4000);
    return () => clearTimeout(t);
  }, [handoff]);

  const canSearch = dropoff.trim().length > 0;
  const grouped = useMemo(
    () =>
      (['uber', 'lyft'] as const)
        .map((p) => ({ provider: p, rows: (estimates ?? []).filter((e) => e.provider === p) }))
        .filter((g) => g.rows.length > 0),
    [estimates],
  );

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Uber & Lyft" title="Ground Transport" />

      {handoff ? (
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="checkmark-circle" size={20} color={palette.good} />
            <View style={{ flex: 1 }}>
              <Text style={type.sub}>Handed off to {handoff}</Text>
              <Text style={type.caption}>Finish booking in the {handoff} app.</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* ── Pickup / dropoff form ── */}
      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Where to?</SectionLabel>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ paddingBottom: 14 }}>
            <StatusDot tone="good" />
          </View>
          <Input
            label="Pickup"
            placeholder="Tap Detect or type an address"
            value={pickup}
            onChangeText={setPickup}
            style={{ flex: 1 }}
          />
          <Button
            title="Detect"
            size="md"
            variant="secondary"
            disabled={locating}
            icon={
              locating ? (
                <ActivityIndicator size="small" color={palette.bright} />
              ) : (
                <Ionicons name="locate" size={14} color={palette.bright} />
              )
            }
            onPress={detect}
            style={{ marginBottom: 2 }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ paddingBottom: 14 }}>
            <StatusDot tone="bad" pulse={false} />
          </View>
          <Input
            label="Dropoff"
            placeholder="Airport or address"
            value={dropoff}
            onChangeText={setDropoff}
            style={{ flex: 1 }}
          />
        </View>

        <Button title="Get Ride Estimates" size="lg" disabled={!canSearch} onPress={getEstimates} />
      </Card>

      {/* ── Results ── */}
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
          <ActivityIndicator color={palette.accent} />
          <Text style={type.bodyDim}>Finding rides near you…</Text>
        </View>
      ) : null}

      {!loading && estimates === null ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
          <Ionicons name="car-sport" size={40} color={palette.faint} />
          <Text style={type.sub}>Compare Uber & Lyft</Text>
          <Text style={[type.bodyDim, { textAlign: 'center', maxWidth: 280 }]}>
            Set your pickup and dropoff, then get side-by-side estimates.
          </Text>
        </View>
      ) : null}

      {grouped.map((group) => (
        <View key={group.provider} style={{ marginTop: spacing.xl }}>
          <SectionLabel>{providerName(group.provider)}</SectionLabel>
          <Card variant="glass">
            {group.rows.map((est, i) => (
              <Pressable
                key={est.id}
                onPress={() => setSelected(est)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.md,
                  },
                  i < group.rows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.line,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <ProviderTile provider={est.provider} />
                <View style={{ flex: 1 }}>
                  <Text style={type.sub}>{est.name}</Text>
                  <Text style={type.caption}>
                    {est.seats} seats · Pickup in {est.etaLabel}
                  </Text>
                </View>
                <Text style={[type.sub, { color: palette.bright }]}>{est.fareLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={palette.faint} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xxl }]}>
        Fare estimates are heuristic; live quotes appear in the provider app.
      </Text>

      {/* ── Confirmation sheet ── */}
      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(4,7,13,0.72)' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setSelected(null)}
            accessibilityLabel="Dismiss"
          />
          {selected ? (
            <View
              style={{
                backgroundColor: palette.elevated,
                borderTopLeftRadius: radii.sheet,
                borderTopRightRadius: radii.sheet,
                borderWidth: 1,
                borderColor: palette.line,
                padding: spacing.xl,
                paddingBottom: insets.bottom + spacing.xl,
                gap: spacing.lg,
              }}
            >
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: palette.separator,
                }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ProviderTile provider={selected.provider} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.overline, { color: palette.bright }]}>
                    {providerName(selected.provider)}
                  </Text>
                  <Text style={type.heading}>{selected.name}</Text>
                </View>
                <Text style={type.caption}>{selected.seats} seats</Text>
              </View>

              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <StatusDot tone="good" pulse={false} />
                  <Text style={type.body} numberOfLines={1}>
                    {pickup.trim() || 'Current location'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <StatusDot tone="bad" pulse={false} />
                  <Text style={type.body} numberOfLines={1}>
                    {dropoff.trim()}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: palette.line,
                  paddingTop: spacing.lg,
                }}
              >
                <View>
                  <Text style={type.caption}>Fare estimate</Text>
                  <Text style={[type.stat, { color: palette.bright }]}>{selected.fareLabel}</Text>
                </View>
                <Text style={type.caption}>Pickup in {selected.etaLabel}</Text>
              </View>
              <Text style={type.caption}>Estimates only — final price set by provider</Text>

              <Button
                title={`Open in ${providerName(selected.provider)}`}
                size="lg"
                onPress={() => void openProvider(selected)}
              />
              <Button title="Cancel" variant="ghost" onPress={() => setSelected(null)} />
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}
