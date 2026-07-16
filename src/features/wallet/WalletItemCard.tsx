import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Badge, palette, radii, shadows, spacing, type } from '@/src/ui';
import { formatDate, formatTime } from '@/src/core/format';
import {
  WALLET_META,
  type WalletItem,
  type WalletKind,
  type WalletStatus,
} from '@/src/core/store/wallet';

// Rich wallet row — port of the iOS `WalletItemCard`: 50pt tinted kind-icon
// tile, title + confirmation + date, status pill, chevron; trailing
// swipe-to-delete with a red trash action.

/** Kind tile colors (iOS WalletItemType hues, dark-theme adjusted). */
export const WALLET_KIND_COLOR: Record<WalletKind, string> = {
  boardingPass: palette.accent, // iOS boarding-pass blue
  hotel: '#9B5DE5', // hotel — purple
  car: palette.good,
  ticket: palette.warn, // event ticket — amber
  other: palette.blueMuted,
};
const KIND_TINT: Record<WalletKind, string> = {
  boardingPass: palette.fillAccent,
  hotel: 'rgba(155,93,229,0.14)',
  car: palette.fillGood,
  ticket: palette.fillWarn,
  other: 'rgba(78,143,212,0.14)',
};

const STATUS_META: Record<WalletStatus, { label: string; tone: 'good' | 'accent' | 'neutral' }> = {
  active: { label: 'Active', tone: 'good' },
  upcoming: { label: 'Upcoming', tone: 'accent' },
  past: { label: 'Past', tone: 'neutral' },
};

const ACTION_WIDTH = 84;

function DeleteAction({
  drag,
  onDelete,
}: {
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + ACTION_WIDTH }],
  }));
  return (
    <Animated.View style={[styles.actionWrap, style]}>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Delete"
      >
        <Ionicons name="trash" size={20} color="#FFFFFF" />
        <Text style={styles.actionLabel}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

export function WalletItemCard({
  item,
  status,
  onPress,
  onDelete,
  dimmed = false,
}: {
  item: WalletItem;
  status: WalletStatus;
  onPress: () => void;
  /** Omit to disable swipe-to-delete for this row. */
  onDelete?: () => void;
  /** Past items render at 0.55 opacity (iOS dims completed docs). */
  dimmed?: boolean;
}) {
  const meta = WALLET_META[item.kind];
  const color = WALLET_KIND_COLOR[item.kind];
  const st = STATUS_META[status];

  const when = item.date
    ? item.date.length > 10
      ? `${formatDate(item.date)} · ${formatTime(item.date)}`
      : formatDate(item.date)
    : undefined;
  const subtitle = [item.code, when ?? item.subtitle].filter(Boolean).join('  ·  ');

  const row = (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <View style={[styles.card, dimmed && { opacity: 0.55 }]}>
        <View style={[styles.iconTile, { backgroundColor: KIND_TINT[item.kind] }]}>
          <Ionicons name={meta.icon as never} size={22} color={color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.sub, { fontSize: 15 }]} numberOfLines={1}>
            {item.title}
          </Text>
          {subtitle ? (
            <Text style={type.caption} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge tone={st.tone} label={st.label} />
          <Ionicons name="chevron-forward" size={14} color={palette.faint} />
        </View>
      </View>
    </Pressable>
  );

  if (!onDelete) return <View style={styles.container}>{row}</View>;

  return (
    <Swipeable
      containerStyle={styles.container}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={(_progress, drag) => <DeleteAction drag={drag} onDelete={onDelete} />}
    >
      {row}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: palette.surfaceGlass,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.card,
  },
  iconTile: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionWrap: {
    width: ACTION_WIDTH,
    paddingLeft: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: radii.card,
    backgroundColor: palette.bad,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
