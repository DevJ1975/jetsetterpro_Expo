import React from 'react';
import { View } from 'react-native';
import { ScreenHeader, spacing } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { ComingSoon } from '@/src/features/common/ComingSoon';

export default function IrisScreen() {
  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader overline="AI travel agent" title="IRIS" style={{ paddingHorizontal: 0 }} />
      <View style={{ flex: 1 }}>
        <ComingSoon
          icon="sparkles"
          title="IRIS is warming up"
          subtitle="Your AI travel agent — grounded in your real itinerary, able to check you in, log expenses, and rebook — arrives next, powered by Claude behind a secure Edge Function."
        />
      </View>
    </Screen>
  );
}
