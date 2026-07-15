import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Badge, Button, Card, Input, SectionLabel, StatusDot, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { Chips } from '@/src/features/common/Chips';
import { estimateCompensation, Region } from '@/src/core/services/compensation';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';

export default function DisruptionScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);

  // Compensation calculator state.
  const [region, setRegion] = useState<Region>('EU');
  const [intraEu, setIntraEu] = useState<'yes' | 'no'>('no');
  const [delay, setDelay] = useState('3.5');
  const [distance, setDistance] = useState('2500');
  const comp = useMemo(
    () =>
      estimateCompensation({
        region,
        intraEu: region === 'EU' && intraEu === 'yes',
        delayHours: parseFloat(delay) || 0,
        distanceKm: parseFloat(distance) || 0,
      }),
    [region, intraEu, delay, distance],
  );

  const rebook = () => {
    const q = encodeURIComponent(`flights ${flight?.item.title ?? ''}`);
    Linking.openURL(`https://www.google.com/travel/flights?q=${q}`).catch(() => {});
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Delay & cancel monitoring" title="Trip Disruption" />
      <PremiumGate feature="Trip Disruption AI">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {!flight ? (
            <Card variant="glass">
              <EmptyState icon="warning" title="No flights to monitor" subtitle="Add a flight and IRIS will watch it for delays and cancellations." />
            </Card>
          ) : (
            <Card variant="glass" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <StatusDot tone="good" />
                <View style={{ flex: 1 }}>
                  <Text style={type.sub}>{flight.item.title}</Text>
                  <Text style={[type.bodyDim, { marginTop: 2 }]}>On time · monitoring for changes</Text>
                </View>
                <Badge tone="good" label="On time" />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                <Button title="Rebook options" size="md" onPress={rebook} />
                <Button title="Notify hotel" variant="secondary" size="md" onPress={() => Linking.openURL('sms:').catch(() => {})} />
              </View>
            </Card>
          )}

          <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
            <SectionLabel>Know your rights</SectionLabel>
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.overline, { color: '#8B92A8' }]}>Route region</Text>
              <Chips
                options={['EU', 'US', 'other'] as Region[]}
                value={region}
                onChange={setRegion}
                labelOf={(r) => (r === 'EU' ? 'EU / EEA' : r === 'US' ? 'US' : 'Other')}
              />
            </View>
            {region === 'EU' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[type.overline, { color: '#8B92A8' }]}>Both airports in EU/EEA?</Text>
                <Chips
                  options={['no', 'yes'] as ('no' | 'yes')[]}
                  value={intraEu}
                  onChange={setIntraEu}
                  labelOf={(v) => (v === 'yes' ? 'Yes (intra-EU)' : 'No')}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input label="Delay (hours)" value={delay} onChangeText={setDelay} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Input label="Distance (km)" value={distance} onChangeText={setDistance} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons
                name={comp.eligible ? 'cash' : 'information-circle'}
                size={24}
                color={comp.eligible ? palette.good : palette.dim}
              />
              <Text style={[type.heading, { color: comp.eligible ? palette.good : palette.dim }]}>
                {comp.amount ? `€${comp.amount.value}` : comp.eligible ? 'Refund owed' : 'No fixed payout'}
              </Text>
            </View>
            <Text style={type.bodyDim}>{comp.note}</Text>
          </Card>
        </View>
      </PremiumGate>
    </Screen>
  );
}
