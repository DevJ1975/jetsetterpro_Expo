import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { Chips } from '@/src/features/common/Chips';
import { makeId, toISODate } from '@/src/core/format';
import { DOC_COLORS } from '@/src/features/vaults/docStyle';
import { DOC_META, DOC_TYPES, DocType, setDocNumber, useVault } from '@/src/core/store/vault';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Default expiry a year out (iOS AddDocumentSheet default). Module-scope so
 *  the impure Date read stays out of render; used as a lazy initializer. */
function defaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toISODate(d);
}

export default function AddDocumentScreen() {
  const router = useRouter();
  const addMeta = useVault((s) => s.addMeta);

  const [docType, setDocType] = useState<DocType>('passport');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [hasExpiry, setHasExpiry] = useState(true);
  // Lazy initializer — computed once on mount, not per render.
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const expiryValid = !hasExpiry || DATE_RE.test(expiry.trim());
  const valid = name.trim().length > 0 && expiryValid;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Allow photo access to attach a photo of your document.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!valid) return;
    const id = makeId();
    const num = number.trim();
    if (num) await setDocNumber(id, num); // → encrypted keychain, never in plain storage
    addMeta({
      id,
      type: docType,
      name: name.trim(),
      expiry: hasExpiry ? expiry.trim() : undefined,
      hasNumber: num.length > 0,
      photoUri,
    });
    router.back();
  };

  const color = DOC_COLORS[docType];

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }} edges={['top']}>
      <ModalHeader title="Add Document" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Type</Text>
          <Chips options={DOC_TYPES} value={docType} onChange={setDocType} labelOf={(t) => DOC_META[t].label} />
        </View>

        <Input label="Name / label" placeholder="US Passport" value={name} onChangeText={setName} autoFocus />
        <Input
          label="Number (encrypted)"
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          secureTextEntry
        />

        {/* Expiry toggle + date (iOS AddDocumentSheet parity) */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.overline, { color: '#8B92A8' }]}>Has an expiry date</Text>
            <Switch
              value={hasExpiry}
              onValueChange={setHasExpiry}
              trackColor={{ false: palette.elevated2, true: palette.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          {hasExpiry ? (
            <>
              <Input
                label="Expires (YYYY-MM-DD)"
                value={expiry}
                onChangeText={setExpiry}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                placeholder="2027-06-30"
              />
              {!expiryValid ? (
                <Text style={[type.caption, { color: palette.bad }]}>
                  Enter the date as YYYY-MM-DD (e.g. 2027-06-30).
                </Text>
              ) : null}
            </>
          ) : null}
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
                <Pressable onPress={pickPhoto} hitSlop={6}>
                  <Text style={[type.body, { color: palette.bright }]}>Replace photo</Text>
                </Pressable>
                <Pressable onPress={() => setPhotoUri(undefined)} hitSlop={6}>
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
                  backgroundColor: `${color}14`,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="image" size={18} color={color} />
              <Text style={[type.body, { color: palette.bright }]}>Attach photo of document</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        The number is written to the device keychain (encrypted at rest). The photo stays on this
        device.
      </Text>
    </Screen>
  );
}
