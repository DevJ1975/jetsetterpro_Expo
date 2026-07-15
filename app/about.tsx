import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { BrandHero } from '@/src/features/about/BrandHero';
import { FounderCard } from '@/src/features/about/FounderCard';
import { TourCarousel } from '@/src/features/about/TourCarousel';
import type { IoniconName } from '@/src/features/onboarding/content';

// About — port of iOS `AboutView.swift`: brand hero, the swipeable feature
// tour built from the product showcase screens, a note from the founder, and
// the Powered-by-Claude footer.

export default function AboutScreen() {
  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader title="About" />

      <BrandHero />

      <View style={styles.section}>
        <SectionHeader icon="sparkles" title="Take the tour" />
        <TourCarousel />
      </View>

      <View style={styles.section}>
        <SectionHeader icon="chatbubble-ellipses" title="From the founder" />
        <View style={{ paddingHorizontal: spacing.xl }}>
          <FounderCard />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.poweredBy}>
          <Ionicons name="sparkles" size={11} color="rgba(59,158,240,0.8)" />
          <Text style={styles.poweredByText}>Powered by Claude</Text>
        </View>
        <Text style={styles.copyright}>© 2026 Trainovate Technologies LLC</Text>
      </View>
    </Screen>
  );
}

function SectionHeader({ icon, title }: { icon: IoniconName; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={12} color={palette.bright} />
      <Text style={[type.overline, { color: palette.bright }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poweredByText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(59,158,240,0.8)',
  },
  copyright: {
    fontSize: 11,
    color: palette.faint,
  },
});
