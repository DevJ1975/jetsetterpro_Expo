import React from 'react';
import { View } from 'react-native';
import { palette } from '../theme';

/** Flight-progress style bar. value: 0..1 */
export default function ProgressBar({ value = 0, height = 6, style }) {
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: 'rgba(59,158,240,0.15)', overflow: 'hidden' }, style]}>
      <View style={{ width: (Math.max(0, Math.min(1, value)) * 100) + '%', height, borderRadius: height / 2, backgroundColor: palette.accent }} />
    </View>
  );
}
