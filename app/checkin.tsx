import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { relativeDayLabel } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useCheckIn } from '@/src/core/store/checkin';
import { deriveFlight, toActivityContent } from '@/src/core/services/flightStatus';
import { FlightLiveActivity } from '@/src/core/services/liveActivity';

type Step = 'seat' | 'confirming' | 'success';
type Cabin = 'first' | 'business' | 'premium';

interface CabinLayout {
  title: string;
  cabin: Cabin;
  rows: number[];
  letters: string[];
  taken: string[];
}

const CABINS: CabinLayout[] = [
  { title: 'First', cabin: 'first', rows: [1, 2], letters: ['A', 'D', 'G', 'K'], taken: ['1A', '2K'] },
  {
    title: 'Business',
    cabin: 'business',
    rows: [3, 4, 5, 6, 7, 8, 9],
    letters: ['A', 'D', 'G', 'K'],
    taken: ['3D', '4G', '5K', '6A', '7D', '8K', '9G'],
  },
  {
    title: 'Premium Economy',
    cabin: 'premium',
    rows: [20, 21, 22, 23, 24, 25],
    letters: ['A', 'B', 'D', 'E', 'F', 'G', 'J', 'K'],
    taken: ['20A', '21F', '22K', '23B', '24E', '25J'],
  },
];

const ALL_TAKEN = new Set(CABINS.flatMap((c) => c.taken));
const DEFAULT_SEAT = '3A'; // Business, matches the iOS default

function cabinForSeat(seat: string): Cabin {
  const row = parseInt(seat, 10);
  if (row >= 1 && row <= 2) return 'first';
  if (row >= 20 && row <= 25) return 'premium';
  return 'business';
}

export default function CheckInScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const markCheckedIn = useCheckIn((s) => s.markCheckedIn);
  const isCheckedIn = useCheckIn((s) => s.isCheckedIn);

  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const derived = useMemo(() => (flight ? deriveFlight(flight.item) : null), [flight]);
  const alreadyIn = derived ? isCheckedIn(derived.flightNumber) : false;

  const [seat, setSeat] = useState(DEFAULT_SEAT);
  const [step, setStep] = useState<Step>(alreadyIn ? 'success' : 'seat');
  const [seatError, setSeatError] = useState<string | null>(null);
  const committed = useRef(alreadyIn); // one-shot guard for success side effects

  // Commit the check-in as a side effect once we reach the success step — never
  // during render (markCheckedIn is a store write). Guarded so re-renders can't
  // re-fire it; pre-armed when the flight was already checked in.
  useEffect(() => {
    if (step !== 'success' || !derived || committed.current) return;
    committed.current = true;
    markCheckedIn(derived.flightNumber);
    void FlightLiveActivity.start(toActivityContent({ ...derived, status: 'Boarding' }));
  }, [step, derived, markCheckedIn]);

  const userCabin = cabinForSeat(seat);

  if (!derived) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Mobile Check-In" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="checkmark-circle" title="No flight to check in for" subtitle="Add an upcoming flight and check in here." />
        </View>
      </Screen>
    );
  }

  const routeLabel = `${derived.origin || '—'} → ${derived.destination || '—'}`;
  const gate = derived.gate ?? '—';

  const confirm = () => {
    if (ALL_TAKEN.has(seat)) {
      setSeatError(`Seat ${seat} is no longer available. Please choose another seat.`);
      return;
    }
    setStep('confirming');
    // Simulate the carrier round-trip, then land on the boarding pass.
    setTimeout(() => setStep('success'), 1500);
  };

  // ── Step: seat map ─────────────────────────────────────────────────────────
  if (step === 'seat') {
    return (
      <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
        <BackHeader overline="Select your seat" title="Mobile Check-In" />

        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[type.heading, { flex: 1 }]}>{derived.flightNumber}</Text>
            <Badge tone="accent" label={`Gate ${gate}`} />
          </View>
          <Text style={[type.sub, { marginTop: 6 }]}>{routeLabel}</Text>
          <Text style={[type.bodyDim, { marginTop: 2 }]}>Departs {relativeDayLabel(derived.departISO).toLowerCase()}</Text>
        </Card>

        {CABINS.map((c) => (
          <Card key={c.cabin} style={{ marginBottom: spacing.md }}>
            <SectionLabel>{c.title}</SectionLabel>
            <View style={{ gap: 6 }}>
              {c.rows.map((row) => (
                <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ width: 20, color: palette.faint, fontSize: 11, textAlign: 'right' }}>{row}</Text>
                  {c.letters.map((letter) => {
                    const id = `${row}${letter}`;
                    const taken = c.taken.includes(id);
                    const selectable = userCabin === c.cabin && !taken;
                    const selected = seat === id;
                    return (
                      <Pressable
                        key={id}
                        disabled={!selectable}
                        onPress={() => {
                          setSeat(id);
                          setSeatError(null);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          borderWidth: selected ? 1.5 : 0.7,
                          borderColor: selected ? palette.good : taken ? palette.line : 'rgba(255,255,255,0.4)',
                          backgroundColor: selected
                            ? 'rgba(65,200,120,0.3)'
                            : taken
                              ? 'rgba(255,255,255,0.16)'
                              : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 9, color: selected ? palette.good : palette.faint }}>{letter}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Card>
        ))}

        <Card style={{ marginBottom: spacing.md }}>
          <SectionLabel>Economy</SectionLabel>
          <Text style={[type.bodyDim, { textAlign: 'center', paddingVertical: spacing.lg }]}>Sold out</Text>
        </Card>

        {seatError ? (
          <Text style={[type.body, { color: palette.bad, textAlign: 'center', marginBottom: spacing.md }]}>
            {seatError}
          </Text>
        ) : null}
        <Button title={`Confirm seat ${seat}`} onPress={confirm} />
      </Screen>
    );
  }

  // ── Step: confirming ───────────────────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <ActivityIndicator size="large" color={palette.bright} />
          <Text style={type.sub}>Checking you in…</Text>
        </View>
      </Screen>
    );
  }

  // ── Step: success ── (side effects committed in the useEffect above) ────────
  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={{ alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(65,200,120,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={30} color={palette.good} />
          </View>
          <Text style={type.display}>You’re checked in</Text>
          <Badge tone="good" label={`Seat ${seat} · Gate ${gate}`} />
        </View>

        <Card variant="glass" style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[type.heading, { flex: 1 }]}>{derived.flightNumber}</Text>
            <Text style={type.sub}>{routeLabel}</Text>
          </View>
          <View style={{ height: 0.5, backgroundColor: palette.line }} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.overline, { color: palette.dim }]}>Seat</Text>
              <Text style={type.sub}>{seat}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.overline, { color: palette.dim }]}>Gate</Text>
              <Text style={type.sub}>{gate}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.overline, { color: palette.dim }]}>E-ticket</Text>
              <Text style={type.sub}>XBZP4Q</Text>
            </View>
          </View>
        </Card>

        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
          A Live Activity tracks this flight on your Lock Screen (device build). Boarding-pass QR connects with
          Apple Wallet / PassKit in a later update.
        </Text>

        <Button title="Done" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
