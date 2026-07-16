import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, palette, spacing, type } from '@/src/ui';
import { useFlightStatus } from '@/src/core/api/flights';
import { cToF, useWeather } from '@/src/core/api/weather';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { useNow } from '@/src/core/useNow';
import type { ItineraryItem, Trip } from '@/src/types/models';
import { weatherVisual } from './WeatherChip';

// Port of iOS HomeView.destinationCard — "AT DESTINATION" kicker, destination
// name, then Local Time (ticking) and Weather info items side by side.

/** UTC-offset minutes parsed from an ISO-8601 string, or null. */
function isoOffsetMinutes(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/(?:Z|([+-])(\d{2}):?(\d{2}))$/);
  if (!m) return null;
  if (!m[1]) return 0;
  const v = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  return m[1] === '-' ? -v : v;
}

export function DestinationCard({
  trip,
  flightItem,
}: {
  trip: Trip;
  flightItem?: ItineraryItem;
}) {
  const now = useNow(1000); // ticking destination clock
  const ident = flightItem ? extractFlightNumber(flightItem.title) : null;
  const date = flightItem?.startDate.slice(0, 10);
  const { data: live } = useFlightStatus(ident, date);
  const weather = useWeather(trip.destination);

  // Destination wall-clock: shift by the offset carried in the live arrival
  // times when available; otherwise fall back to the device clock.
  const offsetMin = isoOffsetMinutes(
    live?.destination.times.estimated ?? live?.destination.times.scheduled,
  );
  const localTime = useMemo(() => {
    const base = new Date(now);
    const shown =
      offsetMin == null
        ? base
        : new Date(now + (offsetMin + base.getTimezoneOffset()) * 60_000);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(shown);
  }, [now, offsetMin]);

  const destName = trip.destination.split(',')[0].trim() || trip.destination;
  const weatherIcon = weather.data ? weatherVisual(weather.data.code) : null;

  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        <View style={styles.kickerRow}>
          <Ionicons name="location" size={12} color={palette.bright} />
          <Text style={[type.overline, { color: palette.bright }]}>At destination</Text>
        </View>

        <Text style={type.heading}>{destName}</Text>

        <View style={styles.infoRow}>
          <InfoItem icon="time" iconColor={palette.bright} label="Local Time" value={localTime} />
          {weather.data ? (
            <InfoItem
              icon={weatherIcon!.icon}
              iconColor={weatherIcon!.color}
              label="Weather"
              value={`${cToF(weather.data.tempC)}°F · ${weather.data.description}`}
            />
          ) : (
            <Text style={[type.caption, { alignSelf: 'flex-end' }]}>
              {weather.isLoading ? 'Loading weather…' : 'Weather unavailable'}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function InfoItem({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={15} color={iconColor} style={{ marginTop: 1 }} />
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  infoItem: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  infoValue: { fontSize: 14, fontWeight: '600', color: palette.text, marginTop: 2 },
});
