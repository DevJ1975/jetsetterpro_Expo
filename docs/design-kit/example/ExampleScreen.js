// Drop-in demo of the kit. Requires expo-linear-gradient for the hero bg:
//   npx expo install expo-linear-gradient
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  palette, gradients, type, spacing,
  Button, Card, Badge, StatusDot, ListRow, ScreenHeader, Input, ProgressBar, SectionLabel,
} from '../index';

export default function ExampleScreen() {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: 64, paddingBottom: 48 }}>
        <ScreenHeader overline="Tokyo · 3 travelers" title="Good evening, Jamil" />

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <Card variant="glass">
            <SectionLabel>Disruption Engine</SectionLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <StatusDot tone="bad" />
              <Text style={type.sub}>AA169 · Major delay</Text>
              <Badge tone="bad" label="+3H 35M" style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={[type.bodyDim, { marginTop: 8 }]}>
              3 rebookings found — best option arrives 30m later.
            </Text>
            <ProgressBar value={0.62} style={{ marginTop: 14 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Review options" size="md" onPress={() => {}} />
              <Button title="Dismiss" variant="secondary" size="md" onPress={() => {}} />
            </View>
          </Card>

          <Card>
            <SectionLabel>Today</SectionLabel>
            <ListRow title="JFK → NRT · Gate B22" subtitle="Boards 9:10 PM" right={<Badge label="On time" tone="good" />} />
            <ListRow title="Park Hyatt Tokyo" subtitle="Late arrival held" right={<Badge label="Held" tone="warn" />} last />
          </Card>

          <Input label="Ask IRIS" placeholder="Move me to the aisle…" />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
