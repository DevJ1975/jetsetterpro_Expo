import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cToF, useWeather } from '@/src/core/api/weather';

// Header weather mini-card — port of the iOS HomeView `weatherMiniCard`:
// multicolor condition symbol, big °F, condition text on a small dark chip.

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Ionicons visual for an Open-Meteo WMO weather code (≈ iOS systemIcon). */
export function weatherVisual(code: number): { icon: IoniconName; color: string } {
  if (code === 0 || code === 1) return { icon: 'sunny', color: '#F6C445' };
  if (code === 2) return { icon: 'partly-sunny', color: '#E8C468' };
  if (code === 3) return { icon: 'cloud', color: '#9BA7BF' };
  if (code === 45 || code === 48) return { icon: 'cloudy', color: '#9BA7BF' };
  if (code >= 71 && code <= 77) return { icon: 'snow', color: '#DDE7F5' };
  if (code >= 95) return { icon: 'thunderstorm', color: '#C9A5FF' };
  if (code >= 51) return { icon: 'rainy', color: '#5BBAFF' };
  return { icon: 'partly-sunny', color: '#E8C468' };
}

/** Small glass chip: condition icon + temperature + description. Renders
 *  nothing until weather resolves (graceful when offline/unresolvable). */
export function WeatherChip({ city }: { city?: string }) {
  const weather = useWeather(city);
  if (!weather.data) return null;
  const { icon, color } = weatherVisual(weather.data.code);
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={26} color={color} />
      <Text style={styles.temp}>{cToF(weather.data.tempC)}°F</Text>
      <Text style={styles.desc} numberOfLines={2}>
        {weather.data.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  temp: { fontSize: 19, fontWeight: '700', color: '#FFFFFF' },
  desc: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 72,
  },
});
