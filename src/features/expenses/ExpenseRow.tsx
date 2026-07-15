import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { palette, spacing, type } from '@/src/ui';
import { formatDate, formatMoney } from '@/src/core/format';
import type { Expense } from '@/src/types/models';
import { EXPENSE_CATEGORY_META } from './categoryMeta';

// Expense list row — port of the iOS ExpenseRowView: solid colored square
// category tile (white glyph), merchant + "Category · date" subtitle, and the
// amount right-aligned in a monospaced face. Trailing swipe reveals Delete
// (the repo's wallet pattern, mirroring the iOS List .onDelete).

export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACTION_W = 76;

function DeleteAction({ drag, onDelete }: { drag: SharedValue<number>; onDelete: () => void }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + ACTION_W }],
  }));
  return (
    <Animated.View style={[styles.actionWrap, style]}>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Delete expense"
      >
        <Ionicons name="trash" size={18} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

export function ExpenseRow({
  expense,
  onDelete,
  convertedLabel,
  extraLine,
  last,
}: {
  expense: Expense;
  /** Omit to disable swipe-to-delete. */
  onDelete?: () => void;
  /** Optional "≈ $12.00" caption under the amount. */
  convertedLabel?: string;
  /** Optional extra caption under the subtitle (e.g. mileage detail). */
  extraLine?: string;
  last?: boolean;
}) {
  const meta = EXPENSE_CATEGORY_META[expense.category];

  const row = (
    <View style={[styles.row, !last && styles.divider]}>
      <View style={[styles.tile, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon as never} size={17} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.merchant}
        </Text>
        <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
          {meta.label} · {formatDate(expense.date)}
        </Text>
        {extraLine ? (
          <Text style={[type.caption, { marginTop: 1, color: palette.faint }]} numberOfLines={1}>
            {extraLine}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: spacing.md }}>
        <Text style={styles.amount}>{formatMoney(expense.amount, expense.currency)}</Text>
        {convertedLabel ? (
          <Text style={[type.caption, { marginTop: 2 }]}>{convertedLabel}</Text>
        ) : null}
      </View>
    </View>
  );

  if (!onDelete) return row;

  return (
    <Swipeable
      friction={2}
      rightThreshold={ACTION_W / 2}
      overshootRight={false}
      renderRightActions={(_progress, drag) => <DeleteAction drag={drag} onDelete={onDelete} />}
    >
      {row}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: 10,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  // iOS: 36pt solid color square, white symbol — spec radius 8.
  tile: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  amount: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  actionWrap: {
    width: ACTION_W,
    paddingLeft: spacing.sm,
    paddingVertical: 6,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.bad,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
