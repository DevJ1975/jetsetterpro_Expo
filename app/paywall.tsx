import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  SuccessAnimation,
  fonts,
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  type,
} from '@/src/ui';
import { GoldGradientText } from '@/src/features/onboarding/GoldGradientText';
import type { IoniconName } from '@/src/features/onboarding/content';

// Paywall — port of iOS `SubscriptionPaywallView.swift`. Prices/strings come
// from the iOS StoreKit config (Config/Products.storekit). Real IAP arrives
// with the subscription phase; during the beta the subscription store is
// already unlocked, so the CTA celebrates and dismisses instead of purchasing.

const FEATURES: { icon: IoniconName; title: string; description: string }[] = [
  { icon: 'sparkles', title: 'AI Travel Concierge', description: 'Unlimited Claude-powered travel advice' },
  { icon: 'airplane', title: 'Live Flight Tracking', description: 'Real-time status, gate & delay alerts' },
  { icon: 'stats-chart', title: 'Expense Analytics', description: 'Multi-currency reports & CSV export' },
  { icon: 'briefcase', title: 'Luggage Tracker', description: 'AirTag & WorldTracer integration' },
  { icon: 'sync', title: 'Cloud Sync', description: 'All your devices, always in sync' },
  { icon: 'ticket', title: 'Booking Assistant', description: 'Live hotel & flight availability' },
];

type ProductId = 'monthly' | 'annual';

const PRODUCTS: {
  id: ProductId;
  name: string;
  price: string;
  cadence: string;
  bestValue?: boolean;
  savings?: string;
}[] = [
  { id: 'monthly', name: 'Pro Monthly', price: '$9.99', cadence: 'Billed every month' },
  {
    id: 'annual',
    name: 'Pro Annual',
    price: '$69.99',
    cadence: 'Billed every year',
    bestValue: true,
    // Same derivation as iOS: (9.99 − 69.99/12) / 9.99 ≈ 42%.
    savings: 'Save 42% vs monthly',
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<ProductId>('annual');
  const [celebrate, setCelebrate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Inner wrapper: absolute children (close, toast) position against the
            safe area rather than the padded SafeAreaView's border box. */}
        <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={styles.headerBlock}>
            <View style={styles.crownCircle}>
              <MaterialCommunityIcons name="crown" size={38} color={palette.champagne} />
            </View>
            <GoldGradientText
              text="JETSETTER PRO"
              fontSize={11}
              fontFamily={fonts.rounded.extrabold}
              letterSpacing={3.5}
              width={200}
            />
            <Text style={[type.title, styles.centered]}>Travel Like an Executive</Text>
            <Text style={styles.subtitle}>One subscription. Every premium feature.</Text>
          </View>

          {/* ── Feature checklist ──────────────────────────────────────── */}
          <View style={{ gap: 10 }}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Ionicons name={f.icon} size={17} color={palette.champagne} style={styles.featureIcon} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureCaption}>{f.description}</Text>
                </View>
                <Ionicons name="checkmark" size={13} color={palette.accent} />
              </View>
            ))}
          </View>

          {/* ── Products ───────────────────────────────────────────────── */}
          <View style={{ gap: 10 }}>
            {PRODUCTS.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selected === p.id}
                onSelect={() => setSelected(p.id)}
              />
            ))}
          </View>

          {/* ── CTA ────────────────────────────────────────────────────── */}
          <View style={{ gap: spacing.md }}>
            <Button title="Start JetSetter Pro" size="lg" onPress={() => setCelebrate(true)} />
            <Text style={styles.betaNote}>
              Purchases activate at launch — everything is unlocked during beta.
            </Text>
          </View>

          {/* ── Restore + legal ────────────────────────────────────────── */}
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Pressable
              onPress={() => showToast('Nothing to restore in beta')}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.restore}>Restore Purchases</Text>
            </Pressable>

            <View style={styles.legalLinks}>
              <Pressable hitSlop={8}>
                <Text style={styles.legalLink}>Terms</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable hitSlop={8}>
                <Text style={styles.legalLink}>Privacy</Text>
              </Pressable>
            </View>
            <Text style={styles.legal}>
              Subscriptions auto-renew unless cancelled at least 24 hours before the period ends.
              Manage anytime in App Store Settings.
            </Text>
          </View>
        </ScrollView>

        <Pressable
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close-circle" size={30} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        </View>
      </SafeAreaView>

      {celebrate ? (
        <SuccessAnimation
          title="You're in"
          subtitle="Beta unlock — every Pro feature is already yours"
          onDismiss={() => {
            setCelebrate(false);
            router.back();
          }}
        />
      ) : null}
    </View>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: (typeof PRODUCTS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.price}${selected ? ', selected' : ''}`}
      style={({ pressed }) => [
        styles.product,
        selected && styles.productSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.bestValue ? (
            <View style={styles.goldBadge}>
              <Text style={styles.goldBadgeText}>BEST VALUE</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.productCadence}>{product.cadence}</Text>
        {product.savings ? <Text style={styles.savings}>{product.savings}</Text> : null}
      </View>
      <Text style={styles.price}>{product.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: 36,
    gap: spacing.xxl,
  },
  headerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  crownCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,166,70,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,166,70,0.35)',
    shadowColor: palette.gold,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  centered: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,158,240,0.12)',
  },
  featureIcon: {
    width: 26,
    textAlign: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  featureCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  productSelected: {
    backgroundColor: palette.fillAccent,
    borderColor: 'rgba(59,158,240,0.45)',
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  productCadence: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  savings: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.accent,
  },
  goldBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(220,166,70,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,166,70,0.5)',
  },
  goldBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: palette.champagne,
  },
  price: {
    fontFamily: fonts.rounded.bold,
    fontSize: 20,
    color: palette.accent,
  },
  betaNote: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.dim,
    textAlign: 'center',
  },
  restore: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legalLink: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  legalDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
  legal: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  toast: {
    position: 'absolute',
    bottom: spacing.xxl,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.card,
  },
  toastText: {
    fontSize: 13,
    color: palette.text,
  },
});
