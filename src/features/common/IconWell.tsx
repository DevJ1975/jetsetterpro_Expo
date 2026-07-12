import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { palette } from '@/src/ui';

/** Design-kit icon well: 40×40 tinted, radius 12, hairline accent border. */
export function IconWell({
  name,
  color = palette.bright,
  size = 20,
  style,
}: {
  name: string;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: palette.fillAccent,
          borderWidth: 1,
          borderColor: palette.line,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={name as never} size={size} color={color} />
    </View>
  );
}
