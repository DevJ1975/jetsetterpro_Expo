import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Input, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Chips } from '@/src/features/common/Chips';

type TripType = 'one-way' | 'round-trip';
type Cabin = 'economy' | 'premium' | 'business' | 'first';

const CABIN_MULT: Record<Cabin, number> = { economy: 1, premium: 1.6, business: 2.9, first: 4 };
const KG_PER_PAX_KM = 0.12; // rough all-in average
const OFFSET_USD_PER_TONNE = 20;

export default function CarbonScreen() {
  const [miles, setMiles] = useState('');
  const [tripType, setTripType] = useState<TripType>('round-trip');
  const [cabin, setCabin] = useState<Cabin>('economy');

  const result = useMemo(() => {
    const mi = parseFloat(miles);
    if (isNaN(mi) || mi <= 0) return null;
    const km = mi * 1.60934;
    const legs = tripType === 'round-trip' ? 2 : 1;
    const kg = km * KG_PER_PAX_KM * CABIN_MULT[cabin] * legs;
    return {
      kg,
      tonnes: kg / 1000,
      offset: (kg / 1000) * OFFSET_USD_PER_TONNE,
      carMiles: kg / 0.404, // avg passenger car ~0.404 kg CO2 / mile
      treeYears: kg / 21, // a mature tree absorbs ~21 kg CO2 / year
    };
  }, [miles, tripType, cabin]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Flight emissions" title="Carbon Footprint" />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Your flight</SectionLabel>
        <Input label="One-way distance (miles)" placeholder="2500" value={miles} onChangeText={setMiles} keyboardType="number-pad" />
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Trip</Text>
          <Chips options={['one-way', 'round-trip'] as TripType[]} value={tripType} onChange={setTripType} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Cabin</Text>
          <Chips options={['economy', 'premium', 'business', 'first'] as Cabin[]} value={cabin} onChange={setCabin} />
        </View>
      </Card>

      {result ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <SectionLabel>Estimated emissions</SectionLabel>
          <Text style={type.display}>{result.kg.toFixed(0)} kg CO₂e</Text>
          <Text style={type.bodyDim}>
            ≈ {result.tonnes.toFixed(2)} tonnes · like driving {result.carMiles.toFixed(0)} miles ·{' '}
            {result.treeYears.toFixed(1)} tree-years to absorb
          </Text>
          <Text style={type.sub}>Offset ≈ ${result.offset.toFixed(2)}</Text>
        </Card>
      ) : (
        <Text style={[type.caption, { marginTop: spacing.lg, textAlign: 'center' }]}>
          Enter a distance to estimate your footprint.
        </Text>
      )}
    </Screen>
  );
}
