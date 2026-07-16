import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import { fonts, palette, spacing } from '@/src/ui';
import { formatDateRange } from '@/src/core/format';
import type { Trip } from '@/src/types/models';

// Port of the iOS TripJournalView.ShareCard — rendered off-screen and captured
// with react-native-view-shot, then handed to the share sheet. Hero gradient,
// stats band, 2×2 top photos, JetSetter wordmark footer.

const WIDTH = 360;
const GAP = 2;
const CELL = (WIDTH - GAP) / 2;

export function ShareCard({
  trip,
  photoCount,
  days,
  activeDays,
  photos,
}: {
  trip: Trip;
  photoCount: number;
  days: number;
  activeDays: number;
  /** Up to 4 top photo URIs (2×2 grid). */
  photos: string[];
}) {
  return (
    <View style={{ width: WIDTH, backgroundColor: '#000' }}>
      {/* Hero */}
      <LinearGradient
        colors={[palette.accent, '#7B3FBF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 150, justifyContent: 'flex-end', padding: spacing.xl }}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
        >
          {trip.destination}
        </Text>
        <Text
          style={{
            fontFamily: fonts.rounded.bold,
            fontSize: 26,
            color: '#FFF',
            marginTop: 4,
          }}
          numberOfLines={1}
        >
          {trip.name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3 }}>
          {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
      </LinearGradient>

      {/* Stats band */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 64,
          backgroundColor: '#000',
        }}
      >
        <StatBlock value={photoCount} label="Photos" />
        <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <StatBlock value={days} label="Days" />
        <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <StatBlock value={activeDays} label="Active days" />
      </View>

      {/* Top photos — 2×2 */}
      {photos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {photos.slice(0, 4).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: CELL, height: CELL, backgroundColor: palette.surface }}
              contentFit="cover"
            />
          ))}
        </View>
      ) : null}

      {/* Footer wordmark */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 46,
          backgroundColor: palette.accent,
        }}
      >
        <Ionicons name="airplane" size={15} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
          Made with JetSetter Pro
        </Text>
      </View>
    </View>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.rounded.extrabold, fontSize: 22, color: '#FFF' }}>
        {value}
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
