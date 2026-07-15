import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, shadows, spacing, type } from '@/src/ui';
import { useCalendarBanner } from './calendarBanner';

/**
 * Slide-down status banner shown after a calendar sync — port of the iOS
 * ItineraryView material banner (`calendarBanner(message:)`): checkmark icon,
 * elevated rounded card, soft shadow, auto-dismiss (3s, handled by the store).
 *
 * Render it as the LAST child of a screen (outside any ScrollView) so it
 * overlays content; it mounts an absolutely-positioned, touch-transparent
 * layer and only shows when the shared store carries a message.
 */
export function CalendarSyncBanner() {
  const message = useCalendarBanner((s) => s.message);
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { top: insets.top + spacing.sm }]}
    >
      {message ? (
        <Animated.View
          entering={SlideInUp.springify().damping(18).stiffness(160)}
          exiting={SlideOutUp.duration(220)}
          style={styles.banner}
        >
          <Ionicons name="checkmark-circle" size={20} color={palette.good} />
          <Text style={[type.body, styles.message]} numberOfLines={2}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 50,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    // Opaque-ish elevated fill ≈ iOS .regularMaterial over the hero gradient.
    backgroundColor: palette.elevated2,
    ...shadows.float,
  },
  message: { flex: 1 },
});
