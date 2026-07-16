import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Card, palette, radii, spacing, type } from '@/src/ui';
import { airportCoord } from '@/src/core/data/airports';

// Deep links open the installed app with the trip pre-filled; when the app
// isn't installed the catch falls back to the provider's mobile web flow.
// Drop-off is always the ORIGIN airport — you ride TO your departure airport
// (the direction the iOS build got wrong).
function rideLinks(originIata: string): {
  uber: { deep: string; web: string };
  lyft: { deep: string; web: string };
} {
  const coord = airportCoord(originIata);
  const nickname = encodeURIComponent(`${originIata} Airport`);
  const uberQuery = coord
    ? `action=setPickup&pickup=my_location&dropoff[latitude]=${coord.lat}&dropoff[longitude]=${coord.lon}&dropoff[nickname]=${nickname}`
    : `action=setPickup&pickup=my_location&dropoff[formatted_address]=${nickname}`;
  const lyftQuery = coord
    ? `id=lyft&destination[latitude]=${coord.lat}&destination[longitude]=${coord.lon}`
    : 'id=lyft';
  return {
    uber: { deep: `uber://?${uberQuery}`, web: `https://m.uber.com/ul/?${uberQuery}` },
    lyft: { deep: `lyft://ridetype?${lyftQuery}`, web: `https://ride.lyft.com/ridetype?${lyftQuery}` },
  };
}

function RideButton({
  name,
  background,
  onPress,
}: {
  name: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 44,
        borderRadius: radii.pill,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name="car" size={16} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{name}</Text>
    </Pressable>
  );
}

/** ORDER A RIDE — Uber/Lyft with drop-off pre-set to the departure airport. */
export function RideshareCard({ originIata }: { originIata: string }) {
  const links = rideLinks(originIata);

  const open = (provider: 'uber' | 'lyft') => {
    const { deep, web } = links[provider];
    Linking.openURL(deep).catch(() => {
      WebBrowser.openBrowserAsync(web).catch(() => {});
    });
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="car" size={12} color={palette.bright} />
        <Text style={[type.overline, { color: palette.bright }]}>Order a ride</Text>
      </View>
      <Text style={type.caption}>Drop-off pre-set to {originIata} Airport.</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <RideButton name="Uber" background="#0A0A0A" onPress={() => open('uber')} />
        <RideButton name="Lyft" background="#B0009F" onPress={() => open('lyft')} />
      </View>
    </Card>
  );
}
