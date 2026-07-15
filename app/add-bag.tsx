// Add a bag — RN port of the iOS `AddBagView` sheet: nickname, airline +
// flight number, 7–10 digit bag-tag validation (the rule WorldTracer enforces
// before tracing), and the AirTag toggle.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Card, Input, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ModalHeader } from '@/src/features/common/ModalHeader';
import { makeId } from '@/src/core/format';
import { useLuggage } from '@/src/core/store/luggage';

export default function AddBagScreen() {
  const router = useRouter();
  const add = useLuggage((s) => s.add);

  const [label, setLabel] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [hasAirTag, setHasAirTag] = useState(false);

  // Tag stripped of whitespace; valid when blank (optional) or 7–10 digits.
  const cleanedTag = tagNumber.replace(/\s+/g, '');
  const tagValid = cleanedTag === '' || /^\d{7,10}$/.test(cleanedTag);
  const valid = label.trim().length > 0 && tagValid;

  const save = () => {
    if (!valid) return;
    add({
      id: makeId(),
      label: label.trim(),
      tagNumber: cleanedTag || undefined,
      airline: airline.trim() || undefined,
      flightNumber: flightNumber.trim().toUpperCase() || undefined,
      hasAirTag,
      status: 'checked',
      updatedAt: new Date().toISOString(),
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }} edges={['top']}>
      <ModalHeader title="Add Bag" onSave={save} saveDisabled={!valid} />
      <Card style={{ gap: spacing.lg }}>
        <Input label="Label" placeholder="Blue Samsonite" value={label} onChangeText={setLabel} autoFocus />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input label="Airline" placeholder="United" value={airline} onChangeText={setAirline} style={{ flex: 1 }} />
          <Input
            label="Flight #"
            placeholder="UA837"
            value={flightNumber}
            onChangeText={setFlightNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Input
            label="Bag tag number (7–10 digits)"
            placeholder="0163845678"
            value={tagNumber}
            onChangeText={setTagNumber}
            keyboardType="number-pad"
          />
          {!tagValid ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning" size={13} color={palette.bad} />
              <Text style={[type.caption, { color: palette.bad, flex: 1 }]}>
                Enter a 7–10 digit bag tag number, or leave blank.
              </Text>
            </View>
          ) : (
            <Text style={type.caption}>
              Printed on your baggage receipt and the tag attached to the bag — used for WorldTracer
              lookups.
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Ionicons name="radio" size={16} color={palette.bright} />
            <Text style={type.body}>AirTag attached</Text>
          </View>
          <Switch
            value={hasAirTag}
            onValueChange={setHasAirTag}
            trackColor={{ false: palette.elevated2, true: palette.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
        {hasAirTag ? (
          <Text style={type.caption}>
            AirTag location lives in Apple Find My — the bag&apos;s Find My button opens it (iOS).
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
