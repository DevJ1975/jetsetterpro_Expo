import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Button, SuccessAnimation, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { statusLabel, statusTone, useFlightStatus } from '@/src/core/api/flights';
import { formatTime, relativeDayLabel } from '@/src/core/format';
import { useCheckIn } from '@/src/core/store/checkin';
import { useTravel } from '@/src/core/store/travel';
import { useWallet } from '@/src/core/store/wallet';
import { airlineCheckInUrl, airlineDisplayName } from '@/src/features/checkin/airlineLinks';
import { BoardingPassCard } from '@/src/features/checkin/BoardingPassCard';
import { SeatMap } from '@/src/features/checkin/SeatMap';
import { deterministicGate, takenSeats } from '@/src/features/checkin/flightHash';
import { MONO, extractIdent, findPassByIdent, parseRoute } from '@/src/features/wallet/passData';

// Check-In flow — port of iOS `CheckInFlowView`: three full-screen steps over
// the dark scaffold. 1) seat map with deterministic availability, 2) a short
// "Checking you in…" spinner, 3) success with the embedded boarding pass.

type Step = 'seat' | 'confirming' | 'success';

function parseGate(location?: string): string | undefined {
  const m = location?.match(/gate\s*([A-Z]?\d+[A-Z]?)/i);
  return m ? m[1].toUpperCase() : undefined;
}

export default function CheckInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ident?: string; date?: string }>();
  const identU = (params.ident || 'AA169').toUpperCase();

  const trips = useTravel((s) => s.trips);
  const stored = useWallet((s) => s.items);
  const upsert = useWallet((s) => s.upsert);
  const markCheckedIn = useCheckIn((s) => s.markCheckedIn);
  const alreadyCheckedIn = useCheckIn((s) => !!s.checkedIn[identU]);
  const storedSeat = useCheckIn((s) => s.seats[identU]);

  // ── Flight summary: live status → wallet/itinerary → deterministic demo ──
  const walletItem = useMemo(() => findPassByIdent(trips, stored, identU), [trips, stored, identU]);
  const itin = useMemo(() => {
    for (const t of trips)
      for (const i of t.items)
        if (i.type === 'flight' && extractIdent(i.title) === identU) return i;
    return undefined;
  }, [trips, identU]);

  // Demo fallback departure (T+12h), captured once in a lazy initializer so
  // render never reads the clock (react-compiler rule).
  const [fallbackDep] = useState(() => new Date(Date.now() + 12 * 3_600_000).toISOString());
  const depISO = params.date || walletItem?.date || itin?.startDate || fallbackDep;

  const { data: status } = useFlightStatus(identU, depISO.slice(0, 10));

  const route = useMemo(() => {
    if (status) return { origin: status.origin.iata, destination: status.destination.iata };
    if (walletItem?.origin && walletItem?.destination)
      return { origin: walletItem.origin, destination: walletItem.destination };
    return (
      parseRoute(walletItem?.title) ??
      parseRoute(walletItem?.location) ??
      parseRoute(itin?.title) ??
      parseRoute(itin?.location)
    );
  }, [status, walletItem, itin]);

  const depInstant = status?.origin.times.estimated ?? status?.origin.times.scheduled ?? depISO;
  const gate =
    status?.origin.gate ??
    parseGate(walletItem?.location) ??
    parseGate(itin?.location) ??
    deterministicGate(identU);
  const routeLabel = route ? `${route.origin} → ${route.destination}` : 'Route TBD';
  const whenLabel =
    depInstant.length > 10
      ? `${relativeDayLabel(depInstant)} · ${formatTime(depInstant)}`
      : relativeDayLabel(depInstant);

  // ── Steps ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(() =>
    alreadyCheckedIn && storedSeat ? 'success' : 'seat',
  );
  const [seat, setSeat] = useState<string | null>(() => storedSeat ?? null);
  const [overlay, setOverlay] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const taken = useMemo(() => takenSeats(identU), [identU]);

  /** Ensure a boarding pass for this flight exists in the wallet (upsert). */
  const ensureWalletPass = (confirmedSeat: string): string => {
    const existing = findPassByIdent(trips, stored, identU);
    if (existing) {
      if (!existing.id.startsWith('derived-')) {
        upsert({
          ...existing,
          ident: identU,
          seat: confirmedSeat,
          origin: existing.origin ?? route?.origin,
          destination: existing.destination ?? route?.destination,
        });
      }
      return existing.id;
    }
    const id = `checkin-${identU}`;
    upsert({
      id,
      kind: 'boardingPass',
      title: route ? `${identU} · ${route.origin} → ${route.destination}` : identU,
      subtitle: airlineDisplayName(identU),
      date: depInstant,
      location: `Gate ${gate}`,
      ident: identU,
      origin: route?.origin,
      destination: route?.destination,
      seat: confirmedSeat,
      airline: airlineDisplayName(identU),
    });
    return id;
  };

  const confirmSeat = () => {
    if (!seat || taken.has(seat)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('confirming');
    timer.current = setTimeout(() => {
      // Commit once, from the timer (event context): mark checked in with the
      // seat, mint/refresh the wallet pass, then celebrate.
      markCheckedIn(identU, seat);
      setWalletId(ensureWalletPass(seat));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      setOverlay(true);
    }, 1600);
  };

  const viewInWallet = () => {
    const target = walletId ?? findPassByIdent(trips, stored, identU)?.id;
    if (target) router.replace({ pathname: '/pass', params: { id: target } });
    else router.replace('/wallet');
  };

  const openAirlineSite = () => {
    void openBrowserAsync(airlineCheckInUrl(identU));
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      {step === 'seat' ? (
        <View style={{ flex: 1 }}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={[type.body, { color: 'rgba(255,255,255,0.75)' }]}>Cancel</Text>
            </Pressable>
            <Text style={[type.sub, { fontSize: 15 }]}>Select your seat</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            {/* Flight summary */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.summaryIdent}>{identU}</Text>
                <View style={{ flex: 1 }} />
                {status ? (
                  <Badge tone={statusTone(status.status)} label={statusLabel(status.status, status.delayMin)} />
                ) : null}
                <View style={styles.gateChip}>
                  <Text style={styles.gateChipText}>Gate {gate}</Text>
                </View>
              </View>
              <Text style={styles.summaryRoute}>{routeLabel}</Text>
              <Text style={styles.summaryWhen}>{whenLabel}</Text>
            </View>

            <View style={{ height: spacing.lg }} />
            <SeatMap taken={taken} selected={seat} onSelect={setSeat} />

            <Pressable onPress={openAirlineSite} hitSlop={8} style={{ marginTop: spacing.xl }}>
              <Text style={[type.caption, { color: palette.bright, textAlign: 'center' }]}>
                Check in on airline site instead
              </Text>
            </Pressable>
          </ScrollView>

          {/* Confirm footer */}
          <View style={styles.footer}>
            <Button
              title={seat ? `Confirm seat ${seat}` : 'Select a seat'}
              size="lg"
              disabled={!seat}
              onPress={confirmSeat}
            />
          </View>
        </View>
      ) : null}

      {step === 'confirming' ? (
        <View style={styles.confirming}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={[type.body, { color: 'rgba(255,255,255,0.85)', fontWeight: '600' }]}>
            Checking you in with {airlineDisplayName(identU)}…
          </Text>
        </View>
      ) : null}

      {step === 'success' ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={26} color={palette.good} />
            </View>
            <Text style={type.heading}>You&apos;re checked in</Text>
            <View style={styles.seatPill}>
              <Text style={[type.caption, { color: palette.good }]}>
                Seat {seat ?? storedSeat ?? '—'} confirmed · Gate {gate}
              </Text>
            </View>
          </View>

          {/* Embedded boarding-pass preview */}
          <BoardingPassCard
            ident={identU}
            date={depInstant}
            seat={seat ?? storedSeat ?? undefined}
          />

          <View style={{ gap: spacing.md }}>
            <Button title="View in Wallet" size="lg" onPress={viewInWallet} />
            <Button title="Done" variant="secondary" size="lg" onPress={() => router.back()} />
          </View>
        </ScrollView>
      ) : null}

      {overlay ? (
        <SuccessAnimation
          title="You're checked in"
          subtitle={`Seat ${seat ?? storedSeat ?? '—'} · ${identU} to ${route?.destination ?? 'your destination'}`}
          referenceNumber={`${identU}-${seat ?? storedSeat ?? ''}`}
          onDismiss={() => setOverlay(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  summaryCard: {
    borderRadius: 16,
    padding: spacing.lg,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryIdent: {
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: 1,
  },
  gateChip: {
    marginLeft: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(59,158,240,0.25)',
  },
  gateChipText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  summaryRoute: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  summaryWhen: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  confirming: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  checkBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.fillGood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.fillGood,
  },
});
