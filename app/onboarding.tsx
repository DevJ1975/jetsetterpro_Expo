import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Input, ScreenHeader, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { IconWell } from '@/src/features/common/IconWell';
import { usePreferences } from '@/src/core/store/preferences';

const HIGHLIGHTS: { icon: string; title: string; body: string }[] = [
  { icon: 'sparkles', title: 'IRIS travel agent', body: 'An AI that knows your itinerary and acts on it.' },
  { icon: 'airplane', title: 'Live flights & disruptions', body: 'Tracking, rebooking, and leave-by timing.' },
  { icon: 'stats-chart', title: 'Expenses on autopilot', body: 'Scan, categorize, and submit in a tap.' },
];

export default function Onboarding() {
  const router = useRouter();
  const setProfile = usePreferences((s) => s.setProfile);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);

  const [name, setName] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [homeCurrency, setHomeCurrency] = useState('USD');

  const finish = () => {
    setProfile({
      name: name.trim(),
      homeAirport: homeAirport.trim().toUpperCase(),
      homeCurrency: homeCurrency.trim().toUpperCase() || 'USD',
    });
    completeOnboarding();
    router.replace('/');
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader overline="Welcome aboard" title="JetSetter Pro" style={{ paddingHorizontal: 0 }} />

      <Card variant="glass" style={{ gap: spacing.md }}>
        <SectionLabel>Your travel co-pilot</SectionLabel>
        {HIGHLIGHTS.map((h) => (
          <View key={h.title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconWell name={h.icon} />
            <View style={{ flex: 1 }}>
              <Text style={type.sub}>{h.title}</Text>
              <Text style={[type.bodyDim, { marginTop: 2 }]}>{h.body}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
        <SectionLabel>Set up your profile</SectionLabel>
        <Input label="Your name" placeholder="Jamil" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input
          label="Home airport"
          placeholder="JFK"
          value={homeAirport}
          onChangeText={setHomeAirport}
          autoCapitalize="characters"
          maxLength={4}
        />
        <Input
          label="Home currency"
          placeholder="USD"
          value={homeCurrency}
          onChangeText={setHomeCurrency}
          autoCapitalize="characters"
          maxLength={3}
        />
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button title="Enter JetSetter Pro" size="lg" onPress={finish} />
        <Button title="Skip for now" variant="ghost" size="md" onPress={finish} />
      </View>
    </Screen>
  );
}
