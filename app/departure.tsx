import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, SectionLabel, StatusDot, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { Chips } from '@/src/features/common/Chips';
import { formatTime } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';

type Lane = 'standard' | 'preCheck' | 'clear';
const LANE_WAIT: Record<Lane, number> = { standard: 30, preCheck: 12, clear: 6 };
const LANE_LABEL: Record<Lane, string> = { standard: 'Standard', preCheck: 'PreCheck', clear: 'CLEAR' };

export default function DepartureOptimizerScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);

  const [drive, setDrive] = useState('30');
  const [lane, setLane] = useState<Lane>('preCheck');
  const [intl, setIntl] = useState<'domestic' | 'international'>('domestic');

  const result = useMemo(() => {
    if (!flight) return null;
    const dep = new Date(flight.item.startDate);
    const driveMin = parseInt(drive, 10) || 0;
    const gateBuffer = 45 + (intl === 'international' ? 30 : 0);
    const lead = driveMin + LANE_WAIT[lane] + gateBuffer;
    const leaveBy = new Date(dep.getTime() - lead * 60_000);
    const minsUntil = Math.round((leaveBy.getTime() - Date.now()) / 60_000);
    return { dep, leaveBy, lead, minsUntil };
  }, [flight, drive, lane, intl]);

  if (!flight || !result) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Departure Optimizer" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="time" title="No upcoming flight" subtitle="Add a flight to your itinerary to get leave-by timing." />
        </View>
      </Screen>
    );
  }

  const overdue = result.minsUntil <= 0;
  const h = Math.floor(Math.abs(result.minsUntil) / 60);
  const m = Math.abs(result.minsUntil) % 60;
  const until = overdue ? 'Leave now' : `Leave in ${h > 0 ? `${h}h ` : ''}${m}m`;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={flight.item.title} title="Departure Optimizer" />

      <Card variant="glass" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <StatusDot tone={overdue ? 'bad' : 'good'} />
          <View style={{ flex: 1 }}>
            <Text style={[type.overline, { color: palette.bright }]}>Leave by</Text>
            <Text style={type.display}>{formatTime(result.leaveBy.toISOString())}</Text>
          </View>
        </View>
        <Text style={[type.sub, { color: overdue ? palette.bad : palette.good }]}>{until}</Text>
        <Text style={type.bodyDim}>
          Flight departs {formatTime(result.dep.toISOString())} · {result.lead} min lead time
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
        <SectionLabel>Adjust</SectionLabel>
        <Input label="Drive to airport (min)" value={drive} onChangeText={setDrive} keyboardType="number-pad" />
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Security lane</Text>
          <Chips options={['standard', 'preCheck', 'clear'] as Lane[]} value={lane} onChange={setLane} labelOf={(l) => LANE_LABEL[l]} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Flight type</Text>
          <Chips options={['domestic', 'international'] as ('domestic' | 'international')[]} value={intl} onChange={setIntl} />
        </View>
      </Card>
    </Screen>
  );
}
