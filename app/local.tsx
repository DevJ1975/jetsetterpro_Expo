import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { useNow } from '@/src/core/useNow';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import {
  isOpenNow,
  sectionExperiences,
  useCityCoords,
  useExperiences,
  type Experience,
  type LatLon,
} from '@/src/features/local/experiences';
import { ExperienceCard } from '@/src/features/local/ExperienceCard';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function mapsUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** RIGHT NOW / TONIGHT / THIS TRIP header + horizontal card carousel. */
function ExperienceSection({
  icon,
  title,
  items,
  now,
  onOpen,
}: {
  icon: IoniconName;
  title: string;
  items: Experience[];
  now: number;
  onOpen: (e: Experience) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.xl,
        }}
      >
        <Ionicons name={icon} size={12} color={palette.bright} />
        <SectionLabel style={{ flex: 1, marginBottom: 0 }}>{title}</SectionLabel>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          gap: spacing.md,
        }}
      >
        {items.map((e) => (
          <ExperienceCard
            key={e.id}
            experience={e}
            openNow={isOpenNow(e.openingHours, new Date(now))}
            onOpen={() => onOpen(e)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface DeviceLocation {
  status: 'denied' | 'granted';
  coords?: LatLon;
  city?: string;
}

/** Permission-aware device location. Only prompts when `mayPrompt` (the user
 *  tapped "Use my location"); the initial pass just reads the current grant. */
async function resolveDeviceLocation(mayPrompt: boolean): Promise<DeviceLocation> {
  try {
    const perm = mayPrompt
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) return { status: 'denied' };
    const pos = await Location.getCurrentPositionAsync({});
    const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    let city: string | undefined;
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      city = places[0]?.city ?? places[0]?.region ?? undefined;
    } catch {
      // City label is cosmetic — coordinates already drive the feed.
    }
    return { status: 'granted', coords, city };
  } catch {
    return { status: 'denied' };
  }
}

function LocalBody() {
  const trips = useTravel((s) => s.trips);
  const trip = useMemo(() => activeOrNextTrip(trips), [trips]);
  const now = useNow(60_000);

  // Location fallback when there's no trip to anchor on (iOS gates the feed on
  // being at the destination; without a trip we anchor on the device instead).
  // attempt > 0 → the user asked, so the permission prompt may be shown.
  const [attempt, setAttempt] = useState(0);
  const deviceLoc = useQuery({
    queryKey: ['local-device-location', attempt],
    queryFn: () => resolveDeviceLocation(attempt > 0),
    enabled: !trip,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const geo = useCityCoords(trip?.destination);
  const coords = trip ? (geo.data ?? null) : (deviceLoc.data?.coords ?? null);
  const locCity = deviceLoc.data?.city ?? null;
  const query = useExperiences(coords ? { lat: coords.lat, lon: coords.lon } : undefined);

  const sections = useMemo(
    () => (query.data ? sectionExperiences(query.data) : null),
    [query.data],
  );

  const cityLabel = trip ? trip.destination.split(',')[0].trim() : (locCity ?? '');

  const openPlace = (e: Experience) => {
    const q = cityLabel ? `${e.name}, ${cityLabel}` : e.name;
    Linking.openURL(mapsUrl(q)).catch(() => {});
  };
  const searchMaps = () => {
    if (!cityLabel) return;
    Linking.openURL(mapsUrl(`things to do in ${cityLabel}`)).catch(() => {});
  };

  // ── Gates ──────────────────────────────────────────────────────────────────

  if (!trip && deviceLoc.data?.status !== 'granted') {
    return (
      <View style={{ paddingHorizontal: spacing.xl }}>
        {deviceLoc.isLoading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={palette.bright} />
          </View>
        ) : (
          <EmptyState
            icon="location"
            title="Not at your destination yet"
            subtitle="Local experiences unlock once you have a trip — or share your location to explore what's around you now."
            actionLabel="Use my location"
            onAction={() => setAttempt((a) => a + 1)}
          />
        )}
      </View>
    );
  }

  if ((trip && geo.isLoading) || query.isLoading) {
    return (
      <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
        <ActivityIndicator color={palette.bright} />
        <Text style={type.bodyDim}>
          Finding experiences {cityLabel ? `near ${cityLabel}` : 'near you'}…
        </Text>
      </View>
    );
  }

  const empty =
    !sections ||
    (sections.rightNow.length === 0 &&
      sections.tonight.length === 0 &&
      sections.thisTrip.length === 0);

  if (query.isError || (trip && !geo.isLoading && !coords) || empty) {
    return (
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        <EmptyState
          icon={query.isError ? 'cloud-offline' : 'sparkles'}
          title={query.isError ? 'Couldn’t load live places' : 'No recommendations yet'}
          subtitle={
            cityLabel
              ? `Nothing surfaced around ${cityLabel} right now. Try Google Maps instead.`
              : 'Nothing surfaced nearby right now.'
          }
          actionLabel={cityLabel ? 'Search on Google Maps' : undefined}
          onAction={cityLabel ? searchMaps : undefined}
        />
      </View>
    );
  }

  return (
    <View>
      <ExperienceSection
        icon="flash"
        title="Right now"
        items={sections.rightNow}
        now={now}
        onOpen={openPlace}
      />
      <ExperienceSection
        icon="moon"
        title="Tonight"
        items={sections.tonight}
        now={now}
        onOpen={openPlace}
      />
      <ExperienceSection
        icon="calendar"
        title="This trip"
        items={sections.thisTrip}
        now={now}
        onOpen={openPlace}
      />
      <Text style={[type.caption, { textAlign: 'center', paddingHorizontal: spacing.xl }]}>
        Live places from OpenStreetMap{cityLabel ? ` around ${cityLabel}` : ''}. Tap a card to open
        it in Maps.
      </Text>
    </View>
  );
}

export default function LocalExperiencesScreen() {
  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Right now · tonight · this trip" title="Local Experiences" />
      <PremiumGate feature="Local Experience Engine">
        <LocalBody />
      </PremiumGate>
    </Screen>
  );
}
