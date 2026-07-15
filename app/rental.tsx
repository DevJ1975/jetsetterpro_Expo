import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Badge, Button, Card, Input, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { formatMoney, parseDate, toISODate } from '@/src/core/format';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import {
  classMeta,
  providerMeta,
  quoteFor,
  rentalDays,
  searchFleet,
  RENTAL_PROVIDERS,
  VEHICLE_CLASSES,
  type RentalProviderId,
  type RentalSort,
  type RentalVehicle,
  type VehicleClassId,
} from '@/src/features/rental/fleet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Brand pill: colored letter square + name, multi-toggle. */
function ProviderPill({
  id,
  selected,
  onToggle,
}: {
  id: RentalProviderId;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = providerMeta(id);
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: selected ? `${meta.color}80` : palette.line,
          backgroundColor: selected ? `${meta.color}1F` : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? meta.color : palette.elevated2,
        }}
      >
        <Text style={{ color: selected ? '#04101F' : palette.dim, fontSize: 12, fontWeight: '800' }}>
          {meta.letter}
        </Text>
      </View>
      <Text
        style={{
          color: selected ? meta.color : palette.dim,
          fontSize: 12,
          fontWeight: '700',
        }}
      >
        {meta.name}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: active ? palette.accent : palette.line,
          backgroundColor: active ? palette.accent : 'transparent',
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={{ color: active ? '#04101F' : palette.dim, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function VehicleRowCard({
  vehicle,
  days,
  onPress,
}: {
  vehicle: RentalVehicle;
  days: number;
  onPress: () => void;
}) {
  const provider = providerMeta(vehicle.provider);
  const cls = classMeta(vehicle.vehicleClass);
  const quote = quoteFor(vehicle, days);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${provider.color}1F`,
            }}
          >
            <Ionicons name={cls.icon as IoniconName} size={26} color={provider.color} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                  backgroundColor: `${provider.color}26`,
                }}
              >
                <Text style={{ color: provider.color, fontSize: 10, fontWeight: '800' }}>
                  {provider.name}
                </Text>
              </View>
              <Text style={type.caption}>{cls.label}</Text>
            </View>
            <Text style={[type.sub, { marginTop: 4 }]} numberOfLines={1}>
              {vehicle.make} {vehicle.model} or similar
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="people" size={12} color={palette.dim} />
                <Text style={type.caption}>{vehicle.seats}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="briefcase" size={12} color={palette.dim} />
                <Text style={type.caption}>{vehicle.bags}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="speedometer" size={12} color={palette.dim} />
                <Text style={type.caption}>{vehicle.unlimitedMileage ? 'Unlimited' : 'Limited miles'}</Text>
              </View>
            </View>
            {vehicle.refundable ? (
              <Badge tone="good" label="Free cancellation" style={{ marginTop: 6 }} />
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={[type.sub, { color: palette.bright }]}>{formatMoney(vehicle.dailyRate)}</Text>
            <Text style={type.caption}>/ day</Text>
            <Text style={[type.caption, { marginTop: 4 }]}>{formatMoney(quote.total)} total</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function SpecTile({ icon, value, label }: { icon: IoniconName; value: string; label: string }) {
  return (
    <View
      style={{
        flexBasis: '46%',
        flexGrow: 1,
        alignItems: 'center',
        gap: 4,
        padding: spacing.md,
        borderRadius: radii.control,
        backgroundColor: palette.elevated2,
      }}
    >
      <Ionicons name={icon} size={18} color={palette.bright} />
      <Text style={[type.body, { fontWeight: '600' }]}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={type.bodyDim}>{label}</Text>
      <Text style={[type.body, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

export default function RentalCarScreen() {
  const trips = useTravel((s) => s.trips);
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);

  // Search form
  const [where, setWhere] = useState((trip?.destination ?? '').split(',')[0].trim());
  const [sameReturn, setSameReturn] = useState(true);
  const [dropoffLoc, setDropoffLoc] = useState('');
  const [pickup, setPickup] = useState(trip?.startDate ?? toISODate());
  const [dropoff, setDropoff] = useState(trip?.endDate ?? toISODate());
  const [providers, setProviders] = useState<RentalProviderId[]>(['enterprise', 'hertz', 'national']);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Results
  const [classFilter, setClassFilter] = useState<VehicleClassId | null>(null);
  const [sort, setSort] = useState<RentalSort>('price');
  const [selected, setSelected] = useState<RentalVehicle | null>(null);

  const days = useMemo(() => rentalDays(pickup, dropoff), [pickup, dropoff]);
  const results = useMemo(
    () => (hasSearched ? searchFleet(providers, classFilter, sort) : []),
    [hasSearched, providers, classFilter, sort],
  );

  const toggleProvider = (id: RentalProviderId) => {
    setProviders((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((p) => p !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const search = () => {
    if (!where.trim()) {
      setError('Enter a pick-up location.');
      return;
    }
    const start = parseDate(pickup).getTime();
    const end = parseDate(dropoff).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('Dates must be YYYY-MM-DD.');
      return;
    }
    if (end < start) {
      setError('Drop-off date must be on or after pick-up.');
      return;
    }
    setError(null);
    setHasSearched(true);
  };

  const book = (v: RentalVehicle) => {
    WebBrowser.openBrowserAsync(providerMeta(v.provider).url).catch(() => {});
  };

  const quote = selected ? quoteFor(selected, days) : null;
  const selProvider = selected ? providerMeta(selected.provider) : null;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Enterprise · Hertz · National" title="Rental Cars" />

      {/* Search form */}
      <Card variant="glass" style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
        <SectionLabel style={{ marginBottom: 0 }}>Search</SectionLabel>
        <Input
          label="Pick-up location"
          placeholder="City or airport code"
          value={where}
          onChangeText={setWhere}
          autoCorrect={false}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="return-down-back" size={16} color={palette.bright} />
            <Text style={type.body}>Return to same location</Text>
          </View>
          <Switch
            value={sameReturn}
            onValueChange={setSameReturn}
            trackColor={{ true: palette.accent, false: palette.elevated2 }}
            thumbColor="#FFF"
          />
        </View>

        {!sameReturn ? (
          <Input
            label="Drop-off location"
            placeholder="Where you'll return it"
            value={dropoffLoc}
            onChangeText={setDropoffLoc}
            autoCorrect={false}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Pick-up date" value={pickup} onChangeText={setPickup} autoCapitalize="none" style={{ flex: 1 }} />
          <Input label="Drop-off date" value={dropoff} onChangeText={setDropoff} autoCapitalize="none" style={{ flex: 1 }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
          <Text style={[type.caption, { marginRight: 'auto' }]}>
            {days} day{days === 1 ? '' : 's'}
          </Text>
          {RENTAL_PROVIDERS.map((p) => (
            <ProviderPill
              key={p.id}
              id={p.id}
              selected={providers.includes(p.id)}
              onToggle={() => toggleProvider(p.id)}
            />
          ))}
        </View>

        {error ? <Text style={[type.caption, { color: palette.bad }]}>{error}</Text> : null}
        <Button title="Search" size="lg" onPress={search} />
      </Card>

      {/* Results */}
      {hasSearched ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <SectionLabel style={{ marginBottom: 0 }}>
                {results.length} vehicle{results.length === 1 ? '' : 's'}
              </SectionLabel>
            </View>
            <Badge tone="warn" label="Sample" />
          </View>

          {/* Class filter chips + sort */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          >
            <Chip label="All" active={classFilter === null} onPress={() => setClassFilter(null)} />
            {VEHICLE_CLASSES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={classFilter === c.id}
                onPress={() => setClassFilter(classFilter === c.id ? null : c.id)}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Text style={type.caption}>Sort by</Text>
            <Chip label="Price" active={sort === 'price'} onPress={() => setSort('price')} />
            <Chip label="Class" active={sort === 'class'} onPress={() => setSort('class')} />
          </View>

          {results.length === 0 ? (
            <Card variant="outline">
              <Text style={type.bodyDim}>
                No vehicles match these filters. Widen the class or provider selection.
              </Text>
            </Card>
          ) : (
            results.map((v) => (
              <VehicleRowCard key={v.id} vehicle={v} days={days} onPress={() => setSelected(v)} />
            ))
          )}

          <Card variant="outline" style={{ marginTop: spacing.sm }}>
            <Text style={type.bodyDim}>
              Sample fleet with illustrative rates for planning. Live pricing and availability load
              on the provider&apos;s site when you book.
            </Text>
          </Card>
        </>
      ) : (
        <Card variant="outline">
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <Ionicons name="car-sport" size={40} color={palette.accent} />
            <Text style={type.sub}>Search rental cars</Text>
            <Text style={[type.bodyDim, { textAlign: 'center' }]}>
              Enter a pick-up location and dates to compare cars from Enterprise, Hertz, and
              National.
            </Text>
          </View>
        </Card>
      )}

      {/* Vehicle detail sheet */}
      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View
            style={{
              maxHeight: '88%',
              backgroundColor: palette.elevated,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              borderWidth: 1,
              borderColor: palette.line,
            }}
          >
            {selected && selProvider && quote ? (
              <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: radii.pill,
                      backgroundColor: `${selProvider.color}26`,
                    }}
                  >
                    <Text style={{ color: selProvider.color, fontSize: 11, fontWeight: '800' }}>
                      {selProvider.letter}
                    </Text>
                    <Text style={{ color: selProvider.color, fontSize: 11, fontWeight: '800' }}>
                      {selProvider.name}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Badge tone="accent" label={classMeta(selected.vehicleClass).label} />
                  <Pressable
                    onPress={() => setSelected(null)}
                    hitSlop={8}
                    style={{ marginLeft: spacing.md }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close-circle" size={26} color={palette.dim} />
                  </Pressable>
                </View>

                <View
                  style={{
                    height: 110,
                    borderRadius: radii.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${selProvider.color}1A`,
                    marginBottom: spacing.md,
                  }}
                >
                  <Ionicons
                    name={classMeta(selected.vehicleClass).icon as IoniconName}
                    size={56}
                    color={selProvider.color}
                  />
                </View>

                <Text style={[type.heading, { textAlign: 'center' }]}>
                  {selected.make} {selected.model} or similar
                </Text>
                <Text style={[type.sub, { textAlign: 'center', color: palette.bright, marginTop: 4 }]}>
                  {formatMoney(selected.dailyRate)} / day
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg }}>
                  <SpecTile icon="people" value={`${selected.seats}`} label="Seats" />
                  <SpecTile icon="briefcase" value={`${selected.bags}`} label="Bags" />
                  <SpecTile icon="cog" value={selected.automatic ? 'Automatic' : 'Manual'} label="Transmission" />
                  <SpecTile
                    icon="speedometer"
                    value={selected.unlimitedMileage ? 'Unlimited' : 'Limited'}
                    label="Mileage"
                  />
                </View>

                {selected.features.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
                    {selected.features.map((f) => (
                      <Badge key={f} tone="good" label={f} />
                    ))}
                  </View>
                ) : null}

                <View style={{ marginTop: spacing.xl }}>
                  <SectionLabel>Price breakdown</SectionLabel>
                  <PriceRow
                    label={`${formatMoney(selected.dailyRate)} × ${days} day${days === 1 ? '' : 's'}`}
                    value={formatMoney(quote.base)}
                  />
                  <PriceRow label="Taxes & fees (est.)" value={formatMoney(quote.taxes)} />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingTop: spacing.sm,
                      marginTop: spacing.xs,
                      borderTopWidth: 0.5,
                      borderTopColor: palette.line,
                    }}
                  >
                    <Text style={type.sub}>Total</Text>
                    <Text style={[type.sub, { color: palette.bright }]}>{formatMoney(quote.total)}</Text>
                  </View>
                  <Text
                    style={[
                      type.caption,
                      { color: selected.refundable ? palette.good : palette.warn, marginTop: spacing.sm },
                    ]}
                  >
                    {selected.refundable ? 'Free cancellation available' : 'Non-refundable rate'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => book(selected)}
                  style={({ pressed }) => [
                    {
                      height: 52,
                      borderRadius: radii.control,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: spacing.sm,
                      backgroundColor: selProvider.color,
                      marginTop: spacing.xl,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="car" size={18} color="#04101F" />
                  <Text style={{ color: '#04101F', fontSize: 17, fontWeight: '700' }}>
                    Book on {selProvider.name}
                  </Text>
                </Pressable>
                <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
                  {`This sample rate is for planning only — ${selProvider.name}'s site shows live pricing and completes the booking.`}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
