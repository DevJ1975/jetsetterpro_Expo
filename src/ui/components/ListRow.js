import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { palette, spacing } from '../theme';
import { haptics } from '@/src/core/haptics';

/** Itinerary/settings row: icon well + title/subtitle + right slot. Min height 56 (44+ hit target). */
export default function ListRow({ icon, title, subtitle, right, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPress ? () => haptics.selection() : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? title : undefined}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && onPress && { backgroundColor: 'rgba(59,158,240,0.06)' }]}
    >
      {icon ? <View style={styles.well}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: spacing.md }}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  well: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.fillAccent, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  sub: { fontSize: 13, color: palette.dim, marginTop: 2 },
});
