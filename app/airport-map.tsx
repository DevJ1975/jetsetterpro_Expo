import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, fonts, palette, radii, spacing, type } from '@/src/ui';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Screen } from '@/src/features/common/Screen';
import { useFlightStatus } from '@/src/core/api/flights';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { airportCoord } from '@/src/core/data/airports';
import { parseRoute } from '@/src/core/flightPhase';
import { usePreferences } from '@/src/core/store/preferences';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import {
  AirportPoi,
  LatLng,
  PoiKind,
  buildAirportModel,
  buildIndoorRoute,
  fallbackGate,
  formatWalkDistance,
  gateFromText,
  haversineM,
  routeDistanceM,
  seededHash,
  walkMinutes,
} from '@/src/features/airport/pois';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_META: Record<PoiKind, { icon: IoniconName; color: string; label: string }> = {
  restaurant: { icon: 'restaurant', color: palette.warn, label: 'Dining' },
  cafe: { icon: 'cafe', color: palette.champagne, label: 'Coffee' },
  lounge: { icon: 'wine', color: palette.accent, label: 'Lounge' },
  gate: { icon: 'airplane', color: palette.bright, label: 'Gate' },
  transit: { icon: 'train', color: palette.good, label: 'Transit' },
  restroom: { icon: 'male-female', color: palette.blueMuted, label: 'Restrooms' },
};

const AMENITY_CHIPS: { kind: PoiKind; label: string }[] = [
  { kind: 'lounge', label: 'Lounges' },
  { kind: 'restaurant', label: 'Dining' },
  { kind: 'cafe', label: 'Coffee' },
  { kind: 'restroom', label: 'Restrooms' },
  { kind: 'transit', label: 'Transit' },
];

const JFK_FALLBACK: LatLng = { latitude: 40.6413, longitude: -73.7781 };

export default function AirportMapScreen() {
  const trips = useTravel((s) => s.trips);
  const homeAirport = usePreferences((s) => s.homeAirport);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);

  // Origin airport of the next flight → home-airport preference → JFK.
  const iata = useMemo(() => {
    const origin = flight ? parseRoute(flight.item.title).origin : '';
    for (const candidate of [origin, homeAirport]) {
      if (candidate && airportCoord(candidate)) return candidate.toUpperCase();
    }
    return 'JFK';
  }, [flight, homeAirport]);

  const center = useMemo<LatLng>(() => {
    const c = airportCoord(iata);
    return c ? { latitude: c.lat, longitude: c.lon } : JFK_FALLBACK;
  }, [iata]);

  // Gate: live status → itinerary text → deterministic placeholder.
  const ident = flight ? extractFlightNumber(flight.item.title) : null;
  const date = flight ? flight.item.startDate.slice(0, 10) : null;
  const { data: status } = useFlightStatus(ident, date);
  const gate =
    status?.origin?.gate ??
    gateFromText(flight?.item.location) ??
    gateFromText(flight?.item.notes) ??
    fallbackGate(iata);

  const model = useMemo(() => buildAirportModel(iata, center, gate), [iata, center, gate]);

  // ── Location permission → blue dot ────────────────────────────────────────
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermission(perm);
      if (perm !== Location.PermissionStatus.GRANTED) return;
      try {
        const pos = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        // Blue dot is a nice-to-have; the map works from the airport centre.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const granted = permission === Location.PermissionStatus.GRANTED;

  // ── Amenity filters / POI selection / wayfinding ──────────────────────────
  const [filters, setFilters] = useState<PoiKind[]>([]);
  const [selectedPoi, setSelectedPoi] = useState<AirportPoi | null>(null);
  const [routeTarget, setRouteTarget] = useState<{ name: string; coordinate: LatLng } | null>(
    null,
  );
  const mapRef = useRef<MapView>(null);

  const toggleFilter = (kind: PoiKind) =>
    setFilters((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const visiblePois = useMemo(
    () =>
      model.pois.filter(
        (p) => p.kind === 'gate' || filters.length === 0 || filters.includes(p.kind),
      ),
    [model, filters],
  );

  // Route starts at the user's fix when it is actually on-airport (the iOS view
  // model's 3 km validation radius); otherwise the airport centre, so a user at
  // home never sees a 400-minute "walk".
  const onSite = userLoc != null && haversineM(userLoc, center) <= 3000;
  const routeStart = onSite && userLoc ? userLoc : center;
  const route = useMemo(() => {
    if (!routeTarget) return null;
    const points = buildIndoorRoute(
      routeStart,
      routeTarget.coordinate,
      seededHash(`${iata}:${routeTarget.name}`),
    );
    const distanceM = routeDistanceM(points);
    return { name: routeTarget.name, points, distanceM, minutes: walkMinutes(distanceM) };
  }, [routeTarget, routeStart, iata]);

  const startRoute = (name: string, coordinate: LatLng) => {
    setSelectedPoi(null);
    setRouteTarget({ name, coordinate });
    const points = buildIndoorRoute(routeStart, coordinate, seededHash(`${iata}:${name}`));
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 140, right: 70, bottom: 280, left: 70 },
      animated: true,
    });
  };

  const insets = useSafeAreaInsets();
  const gateWalkMin = walkMinutes(haversineM(routeStart, model.gatePoint));

  return (
    <Screen scroll={false}>
      <BackHeader overline={`${iata} — Gate ${gate}`} title="Airport Map" />

      <View style={{ flex: 1 }}>
        <MapView
          key={iata}
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={granted}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          onPress={() => setSelectedPoi(null)}
        >
          {visiblePois.map((poi) => {
            const meta = KIND_META[poi.kind];
            return (
              <Marker
                key={poi.id}
                coordinate={poi.coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedPoi(poi);
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(13,20,37,0.94)',
                    borderWidth: 1.5,
                    borderColor: meta.color,
                  }}
                >
                  <Ionicons name={meta.icon} size={14} color={meta.color} />
                </View>
              </Marker>
            );
          })}

          {route ? (
            <Polyline
              coordinates={route.points}
              strokeColor={palette.bright}
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          ) : null}
        </MapView>

        {/* ── Top overlays: amenity chips + permission banner ── */}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: spacing.md, left: 0, right: 0, gap: spacing.sm }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
          >
            {AMENITY_CHIPS.map((chip) => {
              const active = filters.includes(chip.kind);
              return (
                <Pressable
                  key={chip.kind}
                  onPress={() => toggleFilter(chip.kind)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: active ? palette.accent : palette.line,
                    backgroundColor: active ? 'rgba(26,60,110,0.92)' : 'rgba(13,20,37,0.88)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: active ? palette.bright : palette.dim,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {permission === Location.PermissionStatus.DENIED ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <Card variant="glass">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="location-outline" size={16} color={palette.warn} />
                  <Text style={[type.caption, { color: palette.text, flex: 1 }]}>
                    Enable location for the blue dot
                  </Text>
                </View>
              </Card>
            </View>
          ) : null}
        </View>

        {/* ── Bottom overlays: POI detail + wayfinding ── */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + spacing.lg,
            gap: spacing.sm,
          }}
        >
          {selectedPoi ? (
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.fillAccent,
                    borderWidth: 1,
                    borderColor: palette.line,
                  }}
                >
                  <Ionicons
                    name={KIND_META[selectedPoi.kind].icon}
                    size={17}
                    color={KIND_META[selectedPoi.kind].color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.sub} numberOfLines={1}>
                    {selectedPoi.name}
                  </Text>
                  <Text style={type.caption} numberOfLines={1}>
                    {KIND_META[selectedPoi.kind].label} · {selectedPoi.detail} · ~
                    {walkMinutes(haversineM(routeStart, selectedPoi.coordinate))} min walk
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedPoi(null)} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color={palette.dim} />
                </Pressable>
              </View>
              <Button
                title="Directions"
                size="sm"
                variant="secondary"
                icon={<Ionicons name="navigate" size={13} color={palette.bright} />}
                onPress={() => startRoute(selectedPoi.name, selectedPoi.coordinate)}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </Card>
          ) : null}

          {route ? (
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Badge label="Indoor preview" tone="accent" />
                  <Text style={[type.sub, { marginTop: spacing.sm }]} numberOfLines={1}>
                    Route to {route.name}
                  </Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>
                    <Ionicons name="walk" size={12} color={palette.bright} />{' '}
                    {formatWalkDistance(route.distanceM)} · ~{route.minutes} min walk
                  </Text>
                </View>
                <Pressable
                  onPress={() => setRouteTarget(null)}
                  hitSlop={10}
                  accessibilityLabel="Clear route"
                >
                  <Ionicons name="close-circle" size={22} color={palette.dim} />
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <LocationPill
                  icon="location"
                  tint={palette.good}
                  label="Your location"
                  value={onSite ? 'On site' : 'Outside terminal'}
                />
                <Ionicons name="arrow-forward" size={14} color={palette.faint} />
                <LocationPill
                  icon="airplane"
                  tint={palette.bright}
                  label={iata}
                  value={`Gate ${gate}`}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: spacing.md,
                }}
              >
                <Text style={type.caption}>
                  <Ionicons name="walk" size={12} color={palette.bright} /> ~{gateWalkMin} min walk
                </Text>
                <Button
                  title="Route to gate"
                  size="sm"
                  onPress={() => startRoute(`gate ${gate}`, model.gatePoint)}
                />
              </View>
            </Card>
          )}
        </View>
      </View>
    </Screen>
  );
}

/** iOS wayfinding-card pill: tinted icon + tiny label over a bold value. */
function LocationPill({
  icon,
  tint,
  label,
  value,
}: {
  icon: IoniconName;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={11} color={tint} />
        <Text style={[type.overline, { fontSize: 10 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={{ fontFamily: fonts.rounded.bold, fontSize: 15, color: palette.text }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
