import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing } from '../theme';

/** Uppercase section kicker with hairline: THE DISRUPTION ENGINE ———— */
export default function SectionLabel({ children, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.text}>{children}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: palette.bright },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
});
