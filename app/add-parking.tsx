import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { useSaveCelebration } from '@/src/features/common/SaveCelebration';
import { makeId } from '@/src/core/format';
import { deleteUserImage, uploadUserImage } from '@/src/core/firebase/storage';
import { useParking } from '@/src/core/store/parking';

export default function AddParkingScreen() {
  const router = useRouter();
  const setSpot = useParking((s) => s.setSpot);
  const existing = useParking((s) => s.spot);
  const { celebrate, overlay } = useSaveCelebration();

  // Prefill from the active spot so this screen also edits it (single spot).
  const [level, setLevel] = useState(existing?.level ?? '');
  const [section, setSection] = useState(existing?.section ?? '');
  const [stall, setStall] = useState(existing?.spot ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(existing?.photoUri);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | undefined>(
    existing?.coords,
  );
  const [address, setAddress] = useState<string | undefined>(existing?.address);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Worth saving if any field is filled or a pin/photo was captured.
  const valid =
    level.trim().length > 0 ||
    section.trim().length > 0 ||
    stall.trim().length > 0 ||
    note.trim().length > 0 ||
    !!coords ||
    !!photoUri;

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      Alert.alert('Location needed', 'Allow location access to drop a pin on your parking spot.');
      return;
    }
    setLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(next);
      try {
        const places = await Location.reverseGeocodeAsync(next);
        const p = places[0];
        const label = p ? [p.name, p.street, p.city].filter(Boolean).join(', ') : '';
        setAddress(label || undefined);
      } catch {
        /* address is optional — the pin alone still navigates */
      }
    } catch {
      Alert.alert('Location unavailable', 'Could not read your location. Try again.');
    } finally {
      setLocating(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Allow photo access to attach a photo of your spot.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const id = existing?.id ?? makeId();
    // Photo lifecycle: unchanged → keep the existing remote ref; replaced → the
    // same id overwrites the same Storage object (no orphan); removed → delete
    // the old object and clear the refs so it stops displaying + doesn't leak.
    const removedPhoto = !photoUri && !!existing?.storagePath;
    const changedPhoto = !!photoUri && photoUri !== existing?.photoUri;
    const stored = changedPhoto && photoUri ? await uploadUserImage(photoUri, 'parking', id) : null;
    if (removedPhoto && existing?.storagePath) void deleteUserImage(existing.storagePath);
    setSpot({
      id,
      level: level.trim() || undefined,
      section: section.trim() || undefined,
      spot: stall.trim() || undefined,
      note: note.trim() || undefined,
      photoUri,
      remoteUrl: removedPhoto ? undefined : (stored?.url ?? existing?.remoteUrl),
      storagePath: removedPhoto ? undefined : (stored?.path ?? existing?.storagePath),
      coords,
      address,
      // Preserve the original save time when editing an existing spot.
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    celebrate({
      title: existing ? 'Parking updated' : 'Parking saved',
      subtitle: [level.trim(), section.trim(), stall.trim()].filter(Boolean).join(' · ') || 'Pin dropped',
      onDone: () => router.back(),
    });
  };

  return (
    <Screen
      contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
      edges={['top']}
    >
      {overlay}
      <ModalHeader
        title={existing ? 'Edit Parking' : 'Save Parking'}
        onSave={save}
        saveDisabled={!valid}
      />
      <Card style={{ gap: spacing.lg }}>
        <Input label="Level / floor" placeholder="Level 3" value={level} onChangeText={setLevel} autoFocus />
        <Input label="Section / row" placeholder="Blue · Row H" value={section} onChangeText={setSection} />
        <Input
          label="Spot"
          placeholder="H-14"
          value={stall}
          onChangeText={setStall}
          autoCapitalize="characters"
        />
        <Input label="Note (optional)" placeholder="Near the elevator" value={note} onChangeText={setNote} />

        {/* Drop a GPS pin */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Location (optional)</Text>
          {coords ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="location" size={16} color={palette.good} />
              <Text style={[type.caption, { flex: 1 }]} numberOfLines={2}>
                {address ?? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
              </Text>
              <Pressable
                onPress={() => {
                  setCoords(undefined);
                  setAddress(undefined);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove pin"
              >
                <Text style={[type.body, { color: palette.bad }]}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={useMyLocation}
              disabled={locating}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: 'rgba(59,158,240,0.08)',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
            >
              {locating ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Ionicons name="navigate" size={18} color={palette.accent} />
              )}
              <Text style={[type.body, { color: palette.bright }]}>
                {locating ? 'Getting your location…' : 'Use my current location'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Attach photo */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Photo (optional)</Text>
          {photoUri ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Image
                source={{ uri: photoUri }}
                style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: palette.surface }}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Pressable
                  onPress={pickPhoto}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Replace photo"
                >
                  <Text style={[type.body, { color: palette.bright }]}>Replace photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPhotoUri(undefined)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Text style={[type.body, { color: palette.bad }]}>Remove photo</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={pickPhoto}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Attach photo"
            >
              <Ionicons name="camera" size={18} color={palette.accent} />
              <Text style={[type.body, { color: palette.bright }]}>Attach a photo of your spot</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Saved on this device only. The GPS pin lets you navigate back to your car.
      </Text>
    </Screen>
  );
}
