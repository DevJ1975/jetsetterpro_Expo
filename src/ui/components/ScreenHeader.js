import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, type } from '../theme';

/** Large-title screen header with optional overline + right accessory. */
export default function ScreenHeader({ overline, title, right, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={{ flex: 1 }}>
        {overline ? <Text style={[type.overline, { color: palette.bright, marginBottom: 6 }]}>{overline}</Text> : null}
        <Text style={type.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
