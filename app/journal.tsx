import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AnimatedCounter, Button, Card, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { useJournal } from '@/src/core/store/journal';
import { exifCaptureDate, usePhotoMeta } from '@/src/features/journal/photoMeta';
import { ShareCard } from '@/src/features/journal/ShareCard';
import { formatDate, formatDateRange, makeId, parseDate, toISODate } from '@/src/core/format';
import { deleteUserImage, uploadUserImage } from '@/src/core/firebase/storage';

// iOS TripJournalView parity: gradient hero, photos/days/active-days stats,
// 3-col chronological grid, shareable summary card.
//
// Deviation from iOS: PHAsset date-range auto-query needs expo-media-library
// (not installed), and expo-image-picker cannot filter by date — so photos stay
// manually multi-selected, then sorted/labeled by EXIF capture date when the
// picker exposes it (falling back to the day they were added).

const GAP = 4;
const COLS = 3;

export default function JournalScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const photosByTrip = useJournal((s) => s.photos);
  const addPhotos = useJournal((s) => s.addPhotos);
  const removePhoto = useJournal((s) => s.removePhoto);
  const dates = usePhotoMeta((s) => s.dates);
  const setDates = usePhotoMeta((s) => s.setDates);
  const setPaths = usePhotoMeta((s) => s.setPaths);
  const removeUri = usePhotoMeta((s) => s.removeUri);

  const shareRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );
  const photos = useMemo(
    () => (trip ? (photosByTrip[trip.id] ?? []) : []),
    [trip, photosByTrip],
  );

  // Grid grouped by capture date (unknown-date photos first, unlabeled).
  const groups = useMemo(() => {
    const byDate = new Map<string, string[]>();
    for (const uri of photos) {
      const d = dates[uri] ?? '';
      const arr = byDate.get(d) ?? [];
      arr.push(uri);
      byDate.set(d, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, uris]) => ({ date: date || undefined, uris }));
  }, [photos, dates]);

  const durationDays = useMemo(() => {
    if (!trip) return 0;
    const ms = parseDate(trip.endDate).getTime() - parseDate(trip.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [trip]);

  const activeDays = useMemo(() => {
    const known = new Set(photos.map((u) => dates[u]).filter(Boolean)).size;
    return photos.length ? Math.max(1, known) : 0;
  }, [photos, dates]);

  const width = Dimensions.get('window').width;
  const cell = (width - spacing.xl * 2 - GAP * (COLS - 1)) / COLS;

  const pick = async () => {
    if (!trip) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Allow photo access to add memories to your journal.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      exif: true,
    });
    if (res.canceled) return;
    const fallback = toISODate();
    // Back each memory up to Cloud Storage; the durable download URL becomes the
    // stable key (dates + list), and the local uri is the fallback when Storage
    // is unconfigured/offline.
    const uploaded = await Promise.all(
      res.assets.map(async (a) => {
        const stored = await uploadUserImage(a.uri, `journal/${trip.id}`, makeId());
        return { uri: stored?.url ?? a.uri, path: stored?.path, date: exifCaptureDate(a.exif) ?? fallback };
      }),
    );
    uploaded.sort((a, b) => a.date.localeCompare(b.date));
    setDates(Object.fromEntries(uploaded.map((s) => [s.uri, s.date])));
    // Record the Storage path per uri so a removed photo's cloud object is
    // deleted rather than orphaned.
    setPaths(Object.fromEntries(uploaded.flatMap((s) => (s.path ? [[s.uri, s.path]] : []))));
    addPhotos(trip.id, uploaded.map((s) => s.uri));
  };

  const confirmRemove = (uri: string) => {
    if (!trip) return;
    Alert.alert('Remove photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePhoto(trip.id, uri);
          const path = usePhotoMeta.getState().paths[uri];
          if (path) void deleteUserImage(path);
          removeUri(uri);
        },
      },
    ]);
  };

  const shareJournal = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot share images.');
        return;
      }
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      Alert.alert("Couldn't share", 'Something went wrong preparing your journal card.');
    } finally {
      setSharing(false);
    }
  };

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Trip Journal" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="images" title="No trip yet" subtitle="Add a trip to start a journal." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        title="Trip Journal"
        right={
          <Pressable
            onPress={pick}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
          >
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      {/* ── Hero (iOS heroCard: accent → purple gradient) ────────────────── */}
      <LinearGradient
        colors={[palette.accent, '#7B3FBF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: 140,
          borderRadius: radii.card,
          justifyContent: 'flex-end',
          padding: spacing.xl,
        }}
      >
        <Text style={[type.heading, { color: '#FFF' }]} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
          {trip.destination}  ·  {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
      </LinearGradient>

      {photos.length === 0 ? (
        <Card variant="glass" style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="images"
            title="No memories yet"
            subtitle={`Add photos from your ${trip.destination} trip to build a scrapbook.`}
            actionLabel="Add photos"
            onAction={pick}
          />
        </Card>
      ) : (
        <>
          {/* ── Stats (iOS statsCard) ────────────────────────────────────── */}
          <Card variant="glass" style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <StatColumn icon="images" label="Photos" value={photos.length} />
              <View style={{ width: 0.5, height: 40, backgroundColor: palette.line }} />
              <StatColumn icon="calendar" label="Days" value={durationDays} />
              <View style={{ width: 0.5, height: 40, backgroundColor: palette.line }} />
              <StatColumn icon="sunny" label="Active days" value={activeDays} />
            </View>
          </Card>

          {/* ── Moments grid (3-col, grouped by capture date) ────────────── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.xl,
              marginBottom: spacing.sm,
              paddingHorizontal: spacing.xs,
            }}
          >
            <Ionicons name="grid" size={12} color={palette.accent} />
            <Text style={[type.overline, { color: palette.accent }]}>Moments</Text>
          </View>
          {groups.map((group, gi) => (
            <View key={group.date ?? `unknown-${gi}`} style={{ marginBottom: spacing.sm }}>
              {group.date && groups.length > 1 ? (
                <Text style={[type.caption, { marginBottom: 6 }]}>
                  {formatDate(group.date, { month: 'short', day: 'numeric' })}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {group.uris.map((uri) => (
                  <Pressable key={uri} onLongPress={() => confirmRemove(uri)}>
                    <Image
                      source={{ uri }}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: 8,
                        backgroundColor: palette.surface,
                      }}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* ── Share (iOS shareButton → ShareCard render) ───────────────── */}
          <Button
            title={sharing ? 'Preparing…' : 'Share Trip Journal'}
            size="lg"
            disabled={sharing}
            onPress={shareJournal}
            icon={<Ionicons name="share-outline" size={17} color="#04101F" />}
            style={{ marginTop: spacing.lg }}
          />

          {/* Off-screen share card, captured by view-shot on demand. */}
          <View
            style={{ position: 'absolute', left: -9999, top: 0 }}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View ref={shareRef} collapsable={false}>
              <ShareCard
                trip={trip}
                photoCount={photos.length}
                days={durationDays}
                activeDays={activeDays}
                photos={photos.slice(0, 4)}
              />
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

function StatColumn({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon as never} size={11} color={palette.accent} />
        <Text style={[type.overline, { fontSize: 9 }]}>{label}</Text>
      </View>
      <AnimatedCounter target={value} format="integer" style={type.stat} />
    </View>
  );
}
