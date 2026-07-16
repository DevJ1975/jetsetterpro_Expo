import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AnimatedCounter, Card, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Chips } from '@/src/features/common/Chips';
import { greatCircleKm } from '@/src/core/data/airports';
import {
  CLASS_MULTIPLIER,
  DRIVING_KM_PER_KG,
  HOME_ELECTRICITY_KG_PER_HOUR,
  OFFSET_USD_PER_100KG,
  ROUTING_CORRECTION,
  TRAVEL_CLASSES,
  TREE_KG_PER_YEAR,
  co2MassKg,
  co2eKg,
  type TravelClass,
} from '@/src/features/carbon/math';

// iOS CarbonFootprintView parity: IATA route input + class + passengers,
// hero CO₂e number, distance / per-person stats, IN PERSPECTIVE comparisons,
// offset providers, ICAO methodology note. Adds a round-trip toggle (each leg
// contributes its own climb-out burn, so legs multiply the per-leg figure).

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const OFFSET_PROVIDERS = [
  {
    name: 'Cool Effect',
    tagline: 'Gold-standard, retired in your name',
    url: 'https://www.cooleffect.org/business/fly-clean',
  },
  {
    name: 'Wren',
    tagline: 'Monthly subscription for total emissions',
    url: 'https://www.wren.co/calculator/flight',
  },
  {
    name: 'Terrapass',
    tagline: 'US-based projects, custom volumes',
    url: 'https://www.terrapass.com/carbon-footprint-calculator-flights',
  },
] as const;

export default function CarbonScreen() {
  const [origin, setOrigin] = useState('SFO');
  const [destination, setDestination] = useState('NRT');
  const [travelClass, setTravelClass] = useState<TravelClass>('economy');
  const [passengers, setPassengers] = useState(1);
  const [roundTrip, setRoundTrip] = useState(false);

  const sanitize = (t: string) => t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const result = useMemo(() => {
    if (origin.length !== 3 || destination.length !== 3) return null;
    if (origin === destination) return null;
    const gc = greatCircleKm(origin, destination);
    if (gc == null) return null;
    const routedKm = gc * ROUTING_CORRECTION;
    const legs = roundTrip ? 2 : 1;
    const co2e = co2eKg(routedKm, travelClass, passengers, legs);
    const mass = co2MassKg(routedKm, travelClass, passengers, legs);
    return { km: routedKm * legs, co2e, mass };
  }, [origin, destination, travelClass, passengers, roundTrip]);

  const bothEntered = origin.length === 3 && destination.length === 3;
  const sameAirports = bothEntered && origin === destination;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Flight emissions" title="Carbon Footprint" />

      {/* ── Flight input (iOS inputCard) ─────────────────────────────────── */}
      <Card variant="glass" style={{ gap: spacing.lg }}>
        <SectionLabel>Flight</SectionLabel>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
          <AirportField label="From" value={origin} onChange={(t) => setOrigin(sanitize(t))} />
          <Pressable
            onPress={swap}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              marginBottom: 5,
              backgroundColor: palette.fillAccent,
              borderWidth: 1,
              borderColor: palette.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Swap airports"
          >
            <Ionicons name="swap-horizontal" size={18} color={palette.bright} />
          </Pressable>
          <AirportField label="To" value={destination} onChange={(t) => setDestination(sanitize(t))} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={type.overline}>Class</Text>
          <Chips
            options={TRAVEL_CLASSES}
            value={travelClass}
            onChange={setTravelClass}
            labelOf={(c) => `${c[0].toUpperCase()}${c.slice(1)} ×${CLASS_MULTIPLIER[c]}`}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[type.overline, { flex: 1 }]}>Passengers</Text>
          <StepperButton
            icon="remove"
            disabled={passengers <= 1}
            onPress={() => setPassengers((p) => Math.max(1, p - 1))}
          />
          <Text style={[type.stat, { minWidth: 52, textAlign: 'center' }]}>{passengers}</Text>
          <StepperButton
            icon="add"
            disabled={passengers >= 9}
            onPress={() => setPassengers((p) => Math.min(9, p + 1))}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[type.overline, { flex: 1 }]}>Round trip</Text>
          <Switch
            value={roundTrip}
            onValueChange={setRoundTrip}
            trackColor={{ false: palette.elevated2, true: palette.accent }}
            thumbColor="#FFF"
          />
        </View>
      </Card>

      {result ? (
        <>
          {/* ── Hero result (iOS resultCard) ─────────────────────────────── */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <AnimatedCounter
                target={result.co2e}
                format={{ decimal: 0 }}
                style={[type.display, { fontSize: 58, lineHeight: 68 }]}
              />
              <Text style={[type.overline, { fontSize: 13 }]}>kg CO₂e</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xl,
                  marginTop: spacing.md,
                }}
              >
                <StatColumn label="Distance" value={`${Math.round(result.km).toLocaleString('en-US')} km`} />
                <View style={{ width: 0.5, height: 30, backgroundColor: palette.line }} />
                <StatColumn label="Per person" value={`${Math.round(result.co2e / passengers)} kg`} />
              </View>
            </View>
          </Card>

          {/* ── In perspective (iOS comparisonCard — physical CO₂ mass) ──── */}
          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>In perspective</SectionLabel>
            <View style={{ gap: spacing.md }}>
              <ComparisonRow
                icon="leaf"
                tint={palette.good}
                text={`${Math.round(result.mass / TREE_KG_PER_YEAR)} tree-years of sequestration to offset`}
              />
              <ComparisonRow
                icon="car"
                tint={palette.accent}
                text={`Same as driving ${Math.round(result.mass * DRIVING_KM_PER_KG).toLocaleString('en-US')} km in an average car`}
              />
              <ComparisonRow
                icon="flash"
                tint={palette.warn}
                text={`Powers ${Math.round(result.mass / HOME_ELECTRICITY_KG_PER_HOUR).toLocaleString('en-US')} hours of typical US home electricity`}
              />
            </View>
          </Card>

          {/* ── Offset (iOS offsetCard — priced on physical CO₂ mass) ────── */}
          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>Offset this flight</SectionLabel>
            <Text style={type.caption}>
              Verified offset providers retire carbon credits in the same year you fly. Typical
              cost: $0.40–$1.20 per 100 kg CO₂.
            </Text>
            <Text style={[type.sub, { marginTop: spacing.sm }]}>
              Estimated cost: ${((result.mass / 100) * OFFSET_USD_PER_100KG).toFixed(2)}
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {OFFSET_PROVIDERS.map((p) => (
                <Pressable
                  key={p.name}
                  onPress={() => WebBrowser.openBrowserAsync(p.url).catch(() => {})}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    borderRadius: radii.control,
                    backgroundColor: palette.elevated2,
                    borderWidth: 1,
                    borderColor: palette.line,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={type.sub}>{p.name}</Text>
                    <Text style={[type.caption, { marginTop: 1 }]}>{p.tagline}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={palette.accent} />
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : bothEntered ? (
        // ── Unknown airport / invalid route (iOS unknownAirportCard) ────────
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <Ionicons name="help-circle" size={32} color={palette.dim} />
            <Text style={type.sub}>
              {sameAirports ? 'Same origin and destination' : 'Unknown airport code'}
            </Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              {sameAirports
                ? 'Pick two different airports to estimate a flight.'
                : 'Try a 3-letter IATA code like SFO, JFK, LHR, NRT.'}
            </Text>
          </View>
        </Card>
      ) : (
        <Text style={[type.caption, { marginTop: spacing.lg, textAlign: 'center' }]}>
          Enter a route to estimate your footprint.
        </Text>
      )}

      {/* ── Methodology (iOS methodologyCard) ────────────────────────────── */}
      <Card variant="outline" style={{ marginTop: spacing.lg }}>
        <SectionLabel>Methodology</SectionLabel>
        <Text style={type.caption}>
          Based on ICAO Carbon Emissions Calculator methodology. Distance × jet fuel consumption ×
          class-of-service multiplier × passenger share, with an 8% routing correction and a
          radiative-forcing factor for high-altitude emissions.
        </Text>
      </Card>
    </Screen>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function AirportField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={type.overline}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="IATA"
        placeholderTextColor={palette.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={3}
        style={{
          height: 48,
          borderRadius: radii.control,
          borderWidth: 1,
          borderColor: palette.line,
          backgroundColor: 'rgba(22,25,41,0.6)',
          color: palette.text,
          textAlign: 'center',
          fontFamily: MONO,
          fontSize: 22,
          fontWeight: '700',
          letterSpacing: 2,
        }}
      />
    </View>
  );
}

function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={[type.overline, { fontSize: 9 }]}>{label}</Text>
      <Text style={[type.stat, { fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

function ComparisonRow({ icon, text, tint }: { icon: string; text: string; tint: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Ionicons name={icon as never} size={18} color={tint} style={{ width: 24 }} />
      <Text style={[type.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

function StepperButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: palette.elevated2,
        borderWidth: 1,
        borderColor: palette.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'Increase passengers' : 'Decrease passengers'}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={18} color={palette.bright} />
    </Pressable>
  );
}
