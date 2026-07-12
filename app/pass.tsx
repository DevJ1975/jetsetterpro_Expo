import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';

export default function PassScreen() {
  const { title, subtitle, code, location } = useLocalSearchParams<{
    title?: string;
    subtitle?: string;
    code?: string;
    location?: string;
  }>();

  const value = code || title || 'JETSETTER';

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={subtitle || 'Pass'} title={title || 'Boarding Pass'} />

      <Card style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
        {location ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.overline, { color: palette.bright }]}>Gate / Seat</Text>
            <Text style={[type.heading, { marginTop: 4 }]}>{location}</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: '#FFFFFF', padding: spacing.lg, borderRadius: 16 }}>
          <QRCode value={value} size={200} backgroundColor="#FFFFFF" color="#04101F" />
        </View>

        {code ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.overline, { color: palette.dim }]}>Confirmation</Text>
            <Text style={[type.stat, { marginTop: 4, letterSpacing: 2 }]}>{code}</Text>
          </View>
        ) : null}
      </Card>

      <Card variant="outline" style={{ marginTop: spacing.lg }}>
        <SectionLabel>Present at gate</SectionLabel>
        <Text style={type.bodyDim}>
          Scan this code at check-in and boarding. Keep your ID handy.
        </Text>
      </Card>
    </Screen>
  );
}
