import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card, gradients, palette, radii, spacing, type } from '@/src/ui';
import { useIsPro } from '@/src/core/store/subscription';

/**
 * Wraps a premium feature. When the user is Pro the children render as-is;
 * otherwise they are NOT mounted — the iOS-style gate card renders instead:
 * crown badge, "Included with JetSetter Pro", and a gold Upgrade button that
 * routes to the paywall. Pro is unlocked for the beta (see subscription
 * store); real IAP gating arrives with the subscription/paywall phase.
 */
export function PremiumGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const isPro = useIsPro();
  const router = useRouter();
  if (isPro) return <>{children}</>;

  return (
    <View style={{ padding: spacing.xl }}>
      <Card variant="glass">
        <View style={styles.body}>
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons name="crown" size={30} color={palette.champagne} />
          </View>
          <Text style={[type.heading, styles.centered]}>Included with JetSetter Pro</Text>
          <Text style={[type.bodyDim, styles.centered]}>
            {feature} is part of the Pro experience. One subscription unlocks every premium
            feature.
          </Text>
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.upgrade,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <LinearGradient
              colors={gradients.goldText}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeFill}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#231A05" />
              <Text style={styles.upgradeLabel}>Upgrade to Pro</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

/** Small gold "PRO" chip for marking premium rows and headers. */
export function ProBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.proBadge, style]}>
      <MaterialCommunityIcons name="crown" size={10} color={palette.champagne} />
      <Text style={styles.proBadgeText}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,166,70,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,166,70,0.35)',
  },
  centered: {
    textAlign: 'center',
  },
  upgrade: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    borderRadius: radii.control,
    shadowColor: palette.gold,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  upgradeFill: {
    height: 48,
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#231A05',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(220,166,70,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(220,166,70,0.5)',
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: palette.champagne,
  },
});
