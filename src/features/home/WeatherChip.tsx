import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cToF, useWeather } from '@/src/core/api/weather';
import { AnimatedWeatherIcon } from './AnimatedWeatherIcon';

// Header weather mini-card — port of the iOS HomeView `weatherMiniCard`:
// live-animated condition symbol, big °F, condition text on a small dark chip.

export { weatherVisual } from './weatherVisual';

/** Small glass chip: condition icon + temperature + description. Renders
 *  nothing until weather resolves (graceful when offline/unresolvable). */
export function WeatherChip({ city }: { city?: string }) {
  const weather = useWeather(city);
  if (!weather.data) return null;
  return (
    <View style={styles.chip}>
      <AnimatedWeatherIcon code={weather.data.code} size={26} />
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
