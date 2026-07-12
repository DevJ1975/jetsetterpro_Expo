import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { palette, radii, spacing } from '@/src/ui';

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labelOf,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelOf?: (v: T) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: active ? palette.accent : palette.line,
              backgroundColor: active ? palette.fillAccent : 'transparent',
            }}
          >
            <Text style={{ color: active ? palette.bright : palette.dim, fontWeight: '600', fontSize: 13 }}>
              {labelOf ? labelOf(o) : o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
