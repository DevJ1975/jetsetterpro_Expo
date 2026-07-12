import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { ComingSoon } from '@/src/features/common/ComingSoon';

// Single destination for every not-yet-ported feature row in More. As each
// feature is built out in later phases, it graduates to its own route.
export default function FeatureScreen() {
  const { title, subtitle } = useLocalSearchParams<{
    slug: string;
    title?: string;
    subtitle?: string;
  }>();

  const name = title ?? 'Feature';

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <BackHeader overline="Feature" title={name} />
      <View style={{ flex: 1 }}>
        <ComingSoon
          title="Coming soon"
          subtitle={subtitle ? `${subtitle}. Being ported from the iOS app.` : `${name} is being ported from the iOS app.`}
        />
      </View>
    </Screen>
  );
}
