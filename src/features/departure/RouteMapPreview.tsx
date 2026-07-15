import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Badge, Button, Card, palette, radii, spacing, type } from '@/src/ui';
import { airportCoord } from '@/src/core/data/airports';

/** "View route" — an inline expandable map preview of the drive to the origin
 *  airport (RN port of the iOS RouteMapSheet, kept deliberately simple).
 *  No geocoding: the map centers on the origin airport and draws a short
 *  synthetic route in from a typical start point, clearly labeled "Preview". */
export function RouteMapPreview({ originIata, driveMin }: { originIata: string; driveMin: number }) {
  const [open, setOpen] = useState(false);
  const coord = airportCoord(originIata);
  if (!coord) return null;

  // Synthetic "home" point: offset from the airport by a distance implied by
  // the drive-time input (~50 km/h average), with a dogleg so it reads as a
  // route preview rather than a bearing line.
  const km = Math.min(80, Math.max(4, driveMin * 0.85));
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((coord.lat * Math.PI) / 180));
  const airport = { latitude: coord.lat, longitude: coord.lon };
  const home = { latitude: coord.lat - dLat * 0.72, longitude: coord.lon - dLon * 0.66 };
  const bend = { latitude: coord.lat - dLat * 0.3, longitude: coord.lon - dLon * 0.6 };
  const region = {
    latitude: (home.latitude + airport.latitude) / 2,
    longitude: (home.longitude + airport.longitude) / 2,
    latitudeDelta: Math.max(dLat * 1.9, 0.05),
    longitudeDelta: Math.max(dLon * 1.9, 0.05),
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="navigate" size={12} color={palette.bright} />
        <Text style={[type.overline, { color: palette.bright, flex: 1 }]}>Route to {originIata}</Text>
        <Button
          title={open ? 'Hide route' : 'View route'}
          variant="secondary"
          size="sm"
          onPress={() => setOpen((v) => !v)}
        />
      </View>

      {open ? (
        <>
          <View style={{ height: 200, borderRadius: radii.control, overflow: 'hidden' }}>
            <MapView style={{ flex: 1 }} initialRegion={region}>
              <Polyline coordinates={[home, bend, airport]} strokeColor={palette.accent} strokeWidth={4} />
              <Marker coordinate={home} title="Start" pinColor={palette.accent} />
              <Marker coordinate={airport} title={`${originIata} Airport`} description="Drop-off" />
            </MapView>
            <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
              <Badge tone="neutral" label="Preview" />
            </View>
          </View>
          <Text style={type.caption}>
            Illustrative route from a typical start point — not live navigation.
          </Text>
        </>
      ) : null}
    </Card>
  );
}
