import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Dimensions, Pressable, View } from 'react-native';
import { Card, ScreenHeader, palette, spacing } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { useJournal } from '@/src/core/store/journal';

const GAP = 4;
const COLS = 3;

export default function JournalScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const photosByTrip = useJournal((s) => s.photos);
  const addPhotos = useJournal((s) => s.addPhotos);
  const removePhoto = useJournal((s) => s.removePhoto);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );
  const photos = trip ? (photosByTrip[trip.id] ?? []) : [];

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
    });
    if (!res.canceled) addPhotos(trip.id, res.assets.map((a) => a.uri));
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
      <ScreenHeader
        overline={trip.name}
        title="Trip Journal"
        right={
          <Pressable onPress={pick} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
        style={{ paddingHorizontal: 0 }}
      />

      {photos.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="images"
            title="No memories yet"
            subtitle={`Add photos from your ${trip.destination} trip to build a scrapbook.`}
            actionLabel="Add photos"
            onAction={pick}
          />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {photos.map((uri) => (
            <Pressable
              key={uri}
              onLongPress={() =>
                Alert.alert('Remove photo?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removePhoto(trip.id, uri) },
                ])
              }
            >
              <Image
                source={{ uri }}
                style={{ width: cell, height: cell, borderRadius: 8, backgroundColor: palette.surface }}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
