import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { haptics } from '@/src/core/haptics';
import {
  AnimatedCounter,
  Button,
  Card,
  CardAppear,
  SectionLabel,
  SuccessAnimation,
  palette,
  spacing,
  type,
} from '@/src/ui';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { occasionFor } from '@/src/features/home/occasions';
import { Screen } from '@/src/features/common/Screen';
import { DestinationCard } from '@/src/features/home/DestinationCard';
import { DisruptionBanner } from '@/src/features/home/DisruptionBanner';
import { FlightAlertMarquee } from '@/src/features/home/FlightAlertMarquee';
import { LeaveByStrip } from '@/src/features/home/LeaveByStrip';
import { NextFlightCard } from '@/src/features/home/NextFlightCard';
import { WeatherChip } from '@/src/features/home/WeatherChip';
import { IrisSuggestionCard } from '@/src/features/iris/SuggestionCard';
import { useDisruptions } from '@/src/core/api/disruptions';
import { formatMoney, toISODate } from '@/src/core/format';
import { sumByCurrency } from '@/src/core/expenses';
import { usePreferences } from '@/src/core/store/preferences';
import { activeOrNextTrip, nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';

// Home dashboard — section order mirrors iOS HomeView.swift body: header,
// (disruption banner), IRIS suggestion, next-flight hero, leave-by strip,
// destination card, today's spend — each blooming in with a stagger.

const GAP = 24; // iOS VStack(spacing: 24)

/** iOS HomeViewModel.greeting hour buckets. */
function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export default function HomeScreen() {
  const router = useRouter();
  const name = usePreferences((s) => s.name);
  const homeAirport = usePreferences((s) => s.homeAirport);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const birthday = usePreferences((s) => s.birthday);
  const lastCelebratedOn = usePreferences((s) => s.lastCelebratedOn);
  const markCelebrated = usePreferences((s) => s.markCelebrated);
  const reduce = useReduceMotion();
  const [dismissedCelebration, setDismissedCelebration] = useState(false);
  const trips = useTravel((s) => s.trips);
  const expenses = useTravel((s) => s.expenses);
  const disruptions = useDisruptions(5);
  const now = useNow(60_000);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh re-fetches the live layers (flight status, weather) behind
  // the home cards.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.impact('light');
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const destTrip = flight?.trip ?? trip;

  // "TUESDAY, JUL 15" + time-of-day greeting, both off the minute tick.
  const today = new Date(now);
  const dateKicker = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
    .format(today)
    .toUpperCase();
  const firstName = name.trim().split(/\s+/)[0] ?? '';

  // Celebrate the traveler's birthday or a holiday: a festive greeting, plus a
  // one-per-day confetti burst (reduce-motion gated).
  const occasion = occasionFor(today, birthday); // cheap; no memo needed
  const greeting = occasion
    ? `${occasion.greeting}${firstName ? `, ${firstName}` : ''} ${occasion.emoji}`
    : `${greetingFor(today.getHours())}${firstName ? `, ${firstName}` : ''}`;

  // Show the once-a-day confetti when today is an occasion and it hasn't been
  // celebrated yet — derived (no effect); dismissing marks it in the store.
  const todayKey = toISODate(today);
  const showCelebration =
    !!occasion && !reduce && lastCelebratedOn !== todayKey && !dismissedCelebration;

  // Header chip: home-airport weather when set, else next destination.
  const weatherCity = homeAirport.trim() || trip?.destination;

  // Most recent unread disruption within the last 48h drives the banner.
  const alert = useMemo(
    () =>
      disruptions.find(
        (e) => !e.readAt && now - Date.parse(e.createdAt) < 48 * 3_600_000,
      ),
    [disruptions, now],
  );

  // Live flight-change alerts (last 48h) feed the scrolling ticker at the top.
  const flightAlerts = useMemo(
    () => disruptions.filter((e) => now - Date.parse(e.createdAt) < 48 * 3_600_000),
    [disruptions, now],
  );

  // Today's spend, totaled per currency (never summed across currencies).
  const todayISO = toISODate(today);
  const todayTotals = useMemo(
    () => sumByCurrency(expenses.filter((e) => e.date === todayISO)),
    [expenses, todayISO],
  );
  const primarySpend = todayTotals[0] ?? { currency: homeCurrency, total: 0 };
  const extraSpend = todayTotals
    .slice(1)
    .map((t) => formatMoney(t.total, t.currency))
    .join(' · ');

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }} onRefresh={onRefresh} refreshing={refreshing}>
      {showCelebration && occasion ? (
        <SuccessAnimation
          title={`${occasion.greeting}${firstName ? `, ${firstName}` : ''}! ${occasion.emoji}`}
          subtitle={occasion.key === 'birthday' ? 'Wishing you safe and wonderful travels.' : 'From all of us at JetSetter Pro.'}
          onDismiss={() => {
            markCelebrated(todayKey);
            setDismissedCelebration(true);
          }}
        />
      ) : null}

      {/* ── Live flight-change ticker (yellow: gate/delay, red: cancel) ── */}
      {flightAlerts.length > 0 ? (
        <View style={{ marginBottom: spacing.md }}>
          <FlightAlertMarquee events={flightAlerts} />
        </View>
      ) : null}

      {/* ── Header: date kicker + greeting | weather mini-card ── */}
      <CardAppear delay={0} style={{ marginBottom: GAP }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: spacing.md }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={[type.overline, { color: palette.bright, marginBottom: 6 }]}>
              {dateKicker}
            </Text>
            <Text style={[type.display, { fontSize: 30, lineHeight: 37 }]} numberOfLines={2}>
              {greeting}
            </Text>
            {homeAirport.trim() ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Ionicons name="location" size={10} color="rgba(91,186,255,0.8)" />
                <Text style={type.caption}>{homeAirport.trim().toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          <WeatherChip city={weatherCity} />
        </View>
      </CardAppear>

      {/* ── Disruption banner (unread recent event only) ── */}
      {alert ? (
        <CardAppear delay={0.06} style={{ marginBottom: GAP }}>
          <DisruptionBanner event={alert} />
        </CardAppear>
      ) : null}

      {/* ── IRIS proactive suggestion (self-hides; carries its own margin) ── */}
      <CardAppear delay={0.12}>
        <IrisSuggestionCard />
      </CardAppear>

      {/* ── Next-flight hero ── */}
      <CardAppear delay={0.18} style={{ marginBottom: GAP }}>
        <NextFlightCard flight={flight} />
      </CardAppear>

      {/* ── Leave-by strip ── */}
      {flight ? (
        <CardAppear delay={0.24} style={{ marginBottom: GAP }}>
          <LeaveByStrip flight={flight} />
        </CardAppear>
      ) : null}

      {/* ── Destination local time + weather ── */}
      {destTrip ? (
        <CardAppear delay={0.3} style={{ marginBottom: GAP }}>
          <DestinationCard trip={destTrip} flightItem={flight?.item} />
        </CardAppear>
      ) : null}

      {/* ── Today's spend ── */}
      <CardAppear delay={0.36}>
        <Card>
          <SectionLabel>Today</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <AnimatedCounter
                target={primarySpend.total}
                format={{ currency: primarySpend.currency }}
                style={type.stat}
              />
              <Text style={[type.caption, { marginTop: 2 }]}>
                {extraSpend ? `Spent today · ${extraSpend}` : 'Spent today'}
              </Text>
            </View>
            <Button
              title="Add expense"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/add-expense')}
            />
          </View>
        </Card>
      </CardAppear>
    </Screen>
  );
}
