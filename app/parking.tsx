import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Button, Card, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { ParkingCone } from '@/src/features/parking/ParkingCone';
import { formatDate } from '@/src/core/format';
import { useParking } from '@/src/core/store/parking';

/** Human "Saved …" label from a stored ISO timestamp — routed through the repo's
 *  Intl-guarded formatter (returns the raw string if Intl throws on Hermes). */
function savedLabel(iso: string): string {
  return formatDate(iso, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function ParkingScreen() {
  const router = useRouter();
  const spot = useParking((s) => s.spot);
  const clear = useParking((s) => s.clear);

  const openDirections = () => {
    if (!spot?.coords) return;
    const { latitude, longitude } = spot.coords;
    // Walking turn-by-turn to the exact pin. No text query — an address string
    // can make Maps re-search and move the pin off the saved coordinates.
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${latitude},${longitude}&dirflg=w`
        : `google.navigation:q=${latitude},${longitude}&mode=w`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
      ).catch(() => {});
    });
  };

  const confirmClear = () => {
    Alert.alert('Found your car?', 'This clears your saved parking spot.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear() },
    ]);
  };

  const primaryLine = [spot?.level, spot?.section, spot?.spot].filter(Boolean).join('  ·  ');

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="Airport parking"
        title="Where I Parked"
        right={
          spot ? (
            <Pressable
              onPress={() => router.push('/add-parking')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit parking spot"
            >
              <Ionicons name="pencil" size={22} color={palette.bright} />
            </Pressable>
          ) : undefined
        }
      />

      {!spot ? (
        <Card
          variant="glass"
          style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}
        >
          <ParkingCone size={116} />
          <Text style={[type.title, { textAlign: 'center' }]}>No parking saved</Text>
          <Text style={[type.bodyDim, { textAlign: 'center' }]}>
            Before you head to your flight, save where you left the car — level, row, a photo, and a
            pin you can navigate back to.
          </Text>
          <Button title="Save parking spot" onPress={() => router.push('/add-parking')} />
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ParkingCone size={40} />
              {primaryLine ? (
                <Text style={[type.display, { flex: 1 }]}>{primaryLine}</Text>
              ) : (
                <Text style={[type.sub, { flex: 1 }]}>Parking spot</Text>
              )}
            </View>
            {spot.note ? <Text style={type.bodyDim}>{spot.note}</Text> : null}

            {spot.photoUri ? (
              <Image
                source={{ uri: spot.photoUri }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: radii.control,
                  backgroundColor: palette.surface,
                }}
                contentFit="cover"
              />
            ) : null}

            {spot.address || spot.coords ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="location" size={16} color={palette.accent} />
                <Text style={[type.caption, { flex: 1 }]} numberOfLines={2}>
                  {spot.address ??
                    `${spot.coords!.latitude.toFixed(5)}, ${spot.coords!.longitude.toFixed(5)}`}
                </Text>
              </View>
            ) : null}

            <Text style={type.caption}>Saved {savedLabel(spot.createdAt)}</Text>
          </Card>

          {spot.coords ? (
            <Button
              title="Directions to my car"
              variant="secondary"
              icon={<Ionicons name="navigate" size={16} color={palette.bright} />}
              onPress={openDirections}
            />
          ) : null}

          <Button title="Clear — found my car" onPress={confirmClear} />
        </View>
      )}
    </Screen>
  );
}
