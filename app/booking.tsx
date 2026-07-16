import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Input,
  SectionLabel,
  SuccessAnimation,
  palette,
  radii,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import DuffelAncillariesSheet from '@/src/features/booking/DuffelAncillariesSheet';
import { toISODate } from '@/src/core/format';
import {
  DuffelOfferSummary,
  confirmCancel as confirmCancelOrder,
  createOrder,
  getOffer,
  getSeatMaps,
  isBookingAvailable,
  quoteCancel,
  searchOffers,
  useMyOrders,
} from '@/src/core/api/duffel';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { usePreferences } from '@/src/core/store/preferences';

// In-app flight booking (Duffel, test mode in beta) + hotel deep-links.
// Flow: search → offers → passenger → seats & bags (Duffel Ancillaries in a
// WebView — web component, server holds the API key) → order → my bookings.

type Step =
  | { k: 'search' }
  | { k: 'results'; offers: DuffelOfferSummary[] }
  | { k: 'passenger'; offer: DuffelOfferSummary }
  | { k: 'ancillaries'; offer: DuffelOfferSummary; fullOffer: Record<string, unknown>; seatMaps: unknown[] | null; passengers: Record<string, unknown>[] }
  | { k: 'done'; reference: string; amount: string };

const CABINS = ['economy', 'premium_economy', 'business', 'first'] as const;

function fmtMoney(amount?: string, currency?: string) {
  if (!amount) return '—';
  return `${currency ?? ''} ${amount}`.trim();
}

function OfferCard({ offer, onPress }: { offer: DuffelOfferSummary; onPress: () => void }) {
  const first = offer.slices[0];
  const segs = first?.segments ?? [];
  const dep = segs[0]?.departing_at?.slice(11, 16) ?? '—';
  const arr = segs[segs.length - 1]?.arriving_at?.slice(11, 16) ?? '—';
  const stops = Math.max(0, segs.length - 1);
  return (
    <Pressable onPress={onPress}>
      <Card style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.sub}>{offer.owner?.name ?? 'Airline'}</Text>
          <Text style={[type.stat, { fontSize: 20, color: palette.bright }]}>
            {fmtMoney(offer.total_amount, offer.total_currency)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <Text style={[type.body, mono]}>{first?.origin ?? '···'}</Text>
          <Text style={type.bodyDim}>{dep}</Text>
          <Ionicons name="airplane" size={14} color={palette.dim} />
          <Text style={[type.body, mono]}>{first?.destination ?? '···'}</Text>
          <Text style={type.bodyDim}>{arr}</Text>
          <View style={{ flex: 1 }} />
          <Badge tone={stops === 0 ? 'good' : 'neutral'} label={stops === 0 ? 'NONSTOP' : `${stops} STOP${stops > 1 ? 'S' : ''}`} />
        </View>
        {offer.slices.length > 1 ? (
          <Text style={[type.caption, { marginTop: spacing.xs }]}>Round trip · return included</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

const mono = { fontFamily: 'Menlo' } as const;

export default function BookingScreen() {
  const trips = useTravel((s) => s.trips);
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);
  const prefName = usePreferences((s) => s.name);
  const homeAirport = usePreferences((s) => s.homeAirport);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>({ k: 'search' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search form
  const [origin, setOrigin] = useState(homeAirport?.slice(0, 3).toUpperCase() ?? '');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState(trip?.startDate ?? toISODate());
  const [returnDate, setReturnDate] = useState('');
  const [cabin, setCabin] = useState<(typeof CABINS)[number]>('economy');

  // Passenger form (Duffel requires full details for ticketing)
  const nameParts = (prefName ?? '').trim().split(/\s+/);
  const [givenName, setGivenName] = useState(nameParts[0] ?? '');
  const [familyName, setFamilyName] = useState(nameParts.slice(1).join(' '));
  const [bornOn, setBornOn] = useState('1990-01-01');
  const [gender, setGender] = useState<'m' | 'f'>('f');
  const [title, setTitle] = useState<'mr' | 'ms' | 'mrs' | 'dr'>('ms');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const orders = useMyOrders();
  const [cancelling, setCancelling] = useState(false);

  const available = isBookingAvailable();

  const runSearch = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await searchOffers({
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate: departDate.trim(),
        returnDate: returnDate.trim() || undefined,
        cabinClass: cabin,
      });
      setStep({ k: 'results', offers: res.offers });
    } catch (e) {
      setError(bookingError(e));
    } finally {
      setBusy(false);
    }
  };

  const openAncillaries = async (offer: DuffelOfferSummary) => {
    setError(null);
    setBusy(true);
    try {
      const paxId = offer.passengers[0]?.id ?? '';
      const passengers = [
        {
          id: paxId,
          given_name: givenName.trim(),
          family_name: familyName.trim(),
          gender,
          title,
          born_on: bornOn.trim(),
          email: email.trim(),
          phone_number: phone.trim(),
        },
      ];
      const [{ offer: fullOffer }, seatMapsRes] = await Promise.all([
        getOffer(offer.id),
        getSeatMaps(offer.id).catch(() => ({ seat_maps: null as unknown[] | null })),
      ]);
      setStep({ k: 'ancillaries', offer, fullOffer, seatMaps: seatMapsRes.seat_maps, passengers });
    } catch (e) {
      setError(bookingError(e));
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const { order } = await createOrder(payload);
      void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
      setStep({ k: 'done', reference: order.booking_reference ?? order.id, amount: fmtMoney(order.total_amount, order.total_currency) });
    } catch (e) {
      setError(bookingError(e));
      setBusy(false);
    }
  };

  // Two-step cancel: quote the real refund first (a pending Duffel
  // cancellation that lapses harmlessly if not confirmed), show it, then
  // confirm only on the user's explicit choice.
  const confirmCancel = async (orderId: string, ref?: string) => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const { cancellation } = await quoteCancel(orderId);
      const refund = cancellation.refund_amount
        ? `${cancellation.refund_amount} ${cancellation.refund_currency ?? ''}`.trim()
        : 'determined by the airline';
      Alert.alert('Cancel booking', `Cancel ${ref ?? orderId}?\nRefund: ${refund}`, [
        { text: 'Keep booking', style: 'cancel', onPress: () => setCancelling(false) },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await confirmCancelOrder(cancellation.id);
              void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
            } catch (e) {
              Alert.alert('Could not cancel', bookingError(e));
            } finally {
              setCancelling(false);
            }
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Could not cancel', bookingError(e));
      setCancelling(false);
    }
  };

  // Ancillaries step renders full-bleed (WebView needs the height).
  if (step.k === 'ancillaries') {
    return (
      <Screen scroll={false} contentStyle={{ paddingHorizontal: spacing.lg }}>
        <BackHeader overline="Seats & bags" title="Customize" />
        <View style={{ flex: 1, marginBottom: spacing.lg }}>
          <DuffelAncillariesSheet
            offer={step.fullOffer}
            seatMaps={step.seatMaps}
            passengers={step.passengers}
            onReady={({ payload }) => void placeOrder(payload)}
            onError={(m) => setError(m)}
          />
        </View>
        {busy ? (
          <View style={{ position: 'absolute', top: '50%', alignSelf: 'center' }}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        ) : null}
        {error ? <Text style={[type.caption, { color: palette.bad, marginBottom: spacing.lg }]}>{error}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Flights & hotels" title="Book" />

      {step.k === 'done' ? (
        <SuccessAnimation
          title="Booking confirmed"
          subtitle={`Total ${step.amount} · test mode`}
          referenceNumber={step.reference}
          onDismiss={() => setStep({ k: 'search' })}
        />
      ) : null}

      {!available ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={type.bodyDim}>
            In-app booking activates once the backend is deployed (Duffel test mode). Provider search
            links below work today.
          </Text>
        </Card>
      ) : null}

      {available && step.k === 'search' ? (
        <>
          <Card style={{ gap: spacing.md }}>
            <SectionLabel>Find flights</SectionLabel>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input label="From" placeholder="JFK" value={origin} onChangeText={setOrigin} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
              <Input label="To" placeholder="LAX" value={destination} onChangeText={setDestination} autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input label="Depart" value={departDate} onChangeText={setDepartDate} autoCapitalize="none" placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
              <Input label="Return (optional)" value={returnDate} onChangeText={setReturnDate} autoCapitalize="none" placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CABINS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCabin(c)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: radii.pill,
                    backgroundColor: cabin === c ? palette.fillAccent : 'transparent',
                    borderWidth: 1,
                    borderColor: cabin === c ? palette.lineStrong : palette.line,
                  }}
                >
                  <Text style={[type.caption, { color: cabin === c ? palette.bright : palette.dim }]}>
                    {c.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button title={busy ? 'Searching…' : 'Search flights'} onPress={runSearch} disabled={busy || origin.length !== 3 || destination.length !== 3} />
            {error ? <Text style={[type.caption, { color: palette.bad }]}>{error}</Text> : null}
          </Card>

          {orders.data && orders.data.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionLabel>My bookings</SectionLabel>
              {orders.data.map((o) => (
                <View
                  key={o.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderBottomWidth: 0.5,
                    borderBottomColor: palette.separator,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.sub, mono]}>{o.bookingReference ?? o.id.slice(0, 10)}</Text>
                    <Text style={type.caption}>
                      {(o.slices ?? []).map((s) => `${s.origin}→${s.destination}`).join(' · ')} ·{' '}
                      {fmtMoney(o.totalAmount, o.totalCurrency)}
                    </Text>
                  </View>
                  {o.cancelled ? (
                    <Badge tone="bad" label="CANCELLED" />
                  ) : (
                    <Pressable onPress={() => confirmCancel(o.id, o.bookingReference)} hitSlop={8}>
                      <Text style={[type.caption, { color: palette.bad }]}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {available && step.k === 'results' ? (
        <>
          <Pressable onPress={() => setStep({ k: 'search' })} style={{ marginBottom: spacing.sm }}>
            <Text style={[type.caption, { color: palette.bright }]}>‹ Edit search</Text>
          </Pressable>
          <SectionLabel>
            {step.offers.length ? `${step.offers.length} fares` : 'No fares found'}
          </SectionLabel>
          {step.offers.map((o) => (
            <OfferCard key={o.id} offer={o} onPress={() => setStep({ k: 'passenger', offer: o })} />
          ))}
        </>
      ) : null}

      {available && step.k === 'passenger' ? (
        <Card style={{ gap: spacing.md }}>
          <SectionLabel>Passenger</SectionLabel>
          <Text style={type.caption}>
            {step.offer.owner?.name} · {fmtMoney(step.offer.total_amount, step.offer.total_currency)} — seats
            & bags next
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input label="First name" value={givenName} onChangeText={setGivenName} style={{ flex: 1 }} />
            <Input label="Last name" value={familyName} onChangeText={setFamilyName} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input label="Date of birth" value={bornOn} onChangeText={setBornOn} placeholder="YYYY-MM-DD" autoCapitalize="none" style={{ flex: 1 }} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              {(['f', 'm'] as const).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: radii.control,
                    backgroundColor: gender === g ? palette.fillAccent : palette.elevated2,
                    borderWidth: 1,
                    borderColor: gender === g ? palette.lineStrong : palette.line,
                  }}
                >
                  <Text style={type.body}>{g.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['ms', 'mr', 'mrs', 'dr'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTitle(t)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: radii.pill,
                  backgroundColor: title === t ? palette.fillAccent : 'transparent',
                  borderWidth: 1,
                  borderColor: title === t ? palette.lineStrong : palette.line,
                }}
              >
                <Text style={[type.caption, { color: title === t ? palette.bright : palette.dim }]}>
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Phone (+1…)" value={phone} onChangeText={setPhone} autoCapitalize="none" keyboardType="phone-pad" />
          <Button
            title={busy ? 'Loading seats…' : 'Choose seats & bags'}
            onPress={() => void openAncillaries(step.offer)}
            disabled={busy || !givenName.trim() || !familyName.trim() || !email.includes('@') || phone.trim().length < 7}
          />
          <Pressable onPress={() => setStep({ k: 'search' })}>
            <Text style={[type.caption, { color: palette.bright, textAlign: 'center' }]}>Back to search</Text>
          </Pressable>
          {error ? <Text style={[type.caption, { color: palette.bad }]}>{error}</Text> : null}
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Hotels</SectionLabel>
        <HotelLinks trip={trip} />
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        {available
          ? 'Flight booking runs in Duffel test mode during beta — no real tickets are issued.'
          : 'Opens each provider with your dates.'}
      </Text>
    </Screen>
  );
}

function HotelLinks({ trip }: { trip: { destination: string; startDate: string; endDate: string } | null | undefined }) {
  const dest = (trip?.destination ?? '').split(',')[0].trim() || 'destination';
  const checkin = trip?.startDate ?? toISODate();
  const checkout = trip?.endDate ?? toISODate();
  const place = encodeURIComponent(dest);
  const items = [
    { name: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${place}&checkin=${checkin}&checkout=${checkout}` },
    { name: 'Kayak Hotels', url: `https://www.kayak.com/hotels/${place}/${checkin}/${checkout}` },
  ];
  return (
    <>
      {items.map((p, i) => (
        <Pressable
          key={p.name}
          onPress={() => Linking.openURL(p.url).catch(() => {})}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            borderBottomWidth: i === items.length - 1 ? 0 : 0.5,
            borderBottomColor: palette.separator,
          }}
        >
          <Text style={type.sub}>{p.name}</Text>
          <Text style={[type.body, { color: palette.bright }]}>Search →</Text>
        </Pressable>
      ))}
    </>
  );
}

function bookingError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  switch (err.code) {
    case 'duffel_unconfigured':
      return 'Booking backend not deployed yet.';
    case 'rate_limited':
      return 'Too many requests — try again in a minute.';
    case 'bad_request':
      return 'Check the airport codes and dates.';
    default:
      return err.message ?? 'Something went wrong.';
  }
}
