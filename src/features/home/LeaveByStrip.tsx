import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, palette, spacing } from '@/src/ui';
import { estimateSecurityWait } from '@/src/core/api/tsa';
import { useLiveDriveTime } from '@/src/core/api/driveTime';
import { parseRoute } from '@/src/core/flightPhase';
import { formatTime } from '@/src/core/format';
import type { ItineraryItem, Trip } from '@/src/types/models';

// Compact "leave by" strip — port of iOS HomeView.departureCard: car icon in a
// tinted circle, the leave-by time, an estimate caption, chevron → optimizer.
// leaveBy = departure − (drive + TSA estimate + 45 min gate buffer). The drive
// leg uses LIVE traffic (Google Routes) from the user's location when available,
// else a static 45-min estimate.

const DRIVE_MIN = 45;
const GATE_BUFFER_MIN = 45;

export function LeaveByStrip({ flight }: { flight: { trip: Trip; item: ItineraryItem } }) {
  const router = useRouter();
  const item = flight.item;
  const origin = parseRoute(item.location ?? '').origin || parseRoute(item.title).origin;
  const live = useLiveDriveTime(origin || null);
  const driveMin = live.data?.durationMin ?? DRIVE_MIN;
  const liveTraffic = live.data?.durationMin != null;

  const leaveBy = useMemo(() => {
    const dep = new Date(item.startDate);
    const tsa = estimateSecurityWait(origin || undefined, dep, 'standard');
    const leadMin = driveMin + tsa.minutes + GATE_BUFFER_MIN;
    return new Date(dep.getTime() - leadMin * 60_000);
  }, [item, origin, driveMin]);

  return (
    <Pressable onPress={() => router.push('/departure')}>
      {({ pressed }) => (
        <Card style={pressed ? { opacity: 0.85 } : undefined}>
          <View style={styles.row}>
            <View style={styles.iconWell}>
              <Ionicons name="car" size={15} color={palette.bright} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                Leave by {formatTime(leaveBy.toISOString())}
              </Text>
              <Text style={styles.caption} numberOfLines={1}>
                {liveTraffic ? `Live traffic (${driveMin} min drive) + TSA` : 'Traffic + TSA estimate'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.4)" />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: -spacing.xs, // tighter than the default card padding, like iOS
  },
  iconWell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(59,158,240,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.rounded.semibold, fontSize: 17, color: palette.text },
  caption: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
});
