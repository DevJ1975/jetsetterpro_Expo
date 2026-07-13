import React from 'react';
import { View } from 'react-native';
import { palette } from '../theme';

/** Flight-progress style bar. value: 0..1 */
export default function ProgressBar({ value = 0, height = 6, style }) {
  // Guard NaN (e.g. a 0/0 ratio from a consumer) so the width never becomes 'NaN%'.
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: 'rgba(59,158,240,0.15)', overflow: 'hidden' }, style]}>
      <View style={{ width: pct * 100 + '%', height, borderRadius: height / 2, backgroundColor: palette.accent }} />
    </View>
  );
}
