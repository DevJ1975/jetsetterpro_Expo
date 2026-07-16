import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, palette, spacing, type } from '@/src/ui';
import type { WaitEstimate } from '@/src/core/api/tsa';
import { cToF, useWeather } from '@/src/core/api/weather';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Weather icon + delay-risk band per WMO code — mirrors the iOS
// DepartureWeather.risk(forWMOCode:) mapping in DepartureOptimizerService.
function weatherMeta(code: number): { icon: IoniconName; color: string; risk: string } {
  if (code === 0 || code === 1) return { icon: 'sunny', color: palette.good, risk: 'Clear' };
  if ([2, 3, 45, 48].includes(code))
    return { icon: code === 2 ? 'partly-sunny' : 'cloudy', color: palette.warn, risk: 'Caution' };
  if ([51, 53, 61, 71, 80].includes(code))
    return { icon: code === 71 ? 'snow' : 'rainy', color: palette.warn, risk: 'Caution' };
  if ([73, 75].includes(code)) return { icon: 'snow', color: palette.bad, risk: 'High risk' };
  if (code >= 95) return { icon: 'thunderstorm', color: palette.bad, risk: 'High risk' };
  return { icon: 'rainy', color: palette.bad, risk: 'High risk' };
}

function ConditionRow({
  icon,
  color,
  title,
  note,
  value,
  below,
  last,
}: {
  icon: IoniconName;
  color: string;
  title: string;
  note: string;
  value: string;
  below?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.separator,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: palette.fillAccent,
          borderWidth: 1,
          borderColor: palette.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.sub} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.caption, { marginTop: 1 }]} numberOfLines={1}>
          {note}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={[type.sub, { color }]}>{value}</Text>
        {below}
      </View>
    </View>
  );
}

/** LIVE CONDITIONS — traffic · security · weather, the RN port of the iOS
 *  liveConditionsCard. Every number is labeled as an estimate. */
export function LiveConditionsCard({
  driveMin,
  wait,
  originIata,
  originCity,
}: {
  driveMin: number;
  wait: WaitEstimate;
  originIata?: string;
  originCity?: string;
}) {
  const weather = useWeather(originCity);
  const w = weather.data ? weatherMeta(weather.data.code) : null;

  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name="pulse" size={12} color={palette.bright} />
        <Text style={[type.overline, { color: palette.bright }]}>Live conditions</Text>
      </View>

      <ConditionRow
        icon="car"
        color={palette.accent}
        title="Traffic"
        note="Your drive input · typical traffic"
        value={`${driveMin} min`}
      />
      <ConditionRow
        icon="shield-checkmark"
        color={wait.peak ? palette.warn : palette.accent}
        title="Security"
        note={`${wait.range[0]}–${wait.range[1]} min range${wait.peak ? ' · peak hours' : ''}`}
        value={`~${wait.minutes} min`}
        below={<Badge tone={wait.peak ? 'warn' : 'neutral'} label="Estimate" />}
      />
      <ConditionRow
        icon={w?.icon ?? 'cloudy'}
        color={w?.color ?? palette.dim}
        title="Weather"
        note={
          weather.data
            ? `${weather.data.description}${originIata ? ` at ${originIata}` : ''}`
            : weather.isLoading
              ? 'Checking conditions…'
              : 'Unavailable'
        }
        value={weather.data ? `${cToF(weather.data.tempC)}°F` : '—'}
        below={w ? <Text style={[type.caption, { color: w.color }]}>{w.risk}</Text> : undefined}
        last
      />
    </Card>
  );
}
