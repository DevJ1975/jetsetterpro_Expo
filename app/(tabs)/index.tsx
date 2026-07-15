import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ScreenHeader,
  SectionLabel,
  StatusDot,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IrisSuggestionCard } from '@/src/features/iris/SuggestionCard';
import { useWeather, cToF } from '@/src/core/api/weather';
import { formatTime, relativeDayLabel, toISODate } from '@/src/core/format';
import { formatByCurrency } from '@/src/core/expenses';
import { usePreferences } from '@/src/core/store/preferences';
import { activeOrNextTrip, nextUpcomingFlight, useTravel } from '@/src/core/store/travel';

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const name = usePreferences((s) => s.name);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const trips = useTravel((s) => s.trips);
  const expenses = useTravel((s) => s.expenses);

  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const weather = useWeather(trip?.destination);

  const today = toISODate();
  const todaySpendLabel = useMemo(
    () => formatByCurrency(expenses.filter((e) => e.date === today), homeCurrency),
    [expenses, today, homeCurrency],
  );

  // An in-progress multi-day trip should read "Now", not a past start-date label.
  const tripTiming = trip
    ? trip.startDate <= today && trip.endDate >= today
      ? 'Now'
      : relativeDayLabel(trip.startDate)
    : null;
  const overline = trip ? `${trip.destination} · ${tripTiming}` : 'No active trip';

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader
        overline={overline}
        title={`${greetingForNow()}${name ? `, ${name}` : ''}`}
        style={{ paddingHorizontal: 0 }}
      />

      <IrisSuggestionCard />

      {!trip && !flight ? (
        <Card variant="glass">
          <EmptyState
            icon="airplane"
            title="No trips yet"
            subtitle="Add your first trip to see flights, weather, and spend at a glance."
            actionLabel="Add a trip"
            onAction={() => router.push('/add-trip')}
          />
        </Card>
      ) : null}

      {flight ? (
        <Card variant="glass" style={{ gap: spacing.md }}>
          <SectionLabel>Next flight</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <StatusDot tone="good" />
            <Text style={[type.sub, { flex: 1 }]}>{flight.item.title}</Text>
            <Badge tone="good" label="On time" />
          </View>
          <Text style={type.bodyDim}>
            Departs {relativeDayLabel(flight.item.startDate).toLowerCase()} at {formatTime(flight.item.startDate)}
            {flight.item.location ? ` · ${flight.item.location}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
            <Button title="View itinerary" size="md" onPress={() => router.push('/itinerary')} />
            <Button
              title="Track"
              variant="secondary"
              size="md"
              onPress={() => router.push('/itinerary')}
            />
          </View>
        </Card>
      ) : null}

      {trip ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionLabel>At {trip.destination}</SectionLabel>
          {weather.data ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
              <Text style={type.stat}>
                {cToF(weather.data.tempC)}°F
              </Text>
              <Text style={type.bodyDim}>{weather.data.description}</Text>
            </View>
          ) : (
            <Text style={type.bodyDim}>{weather.isLoading ? 'Loading weather…' : 'Weather unavailable'}</Text>
          )}
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Today</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.stat}>{todaySpendLabel}</Text>
            <Text style={[type.caption, { marginTop: 2 }]}>Spent today</Text>
          </View>
          <Button title="Add expense" variant="secondary" size="sm" onPress={() => router.push('/add-expense')} />
        </View>
      </Card>
    </Screen>
  );
}
