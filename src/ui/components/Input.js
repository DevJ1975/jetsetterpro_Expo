import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { palette, radii, spacing } from '../theme';

export default function Input({ label, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={palette.faint}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus && props.onFocus(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur && props.onBlur(e); }}
        style={[styles.input, focused && styles.focused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: palette.dim, marginBottom: 8 },
  input: {
    height: 48, borderRadius: radii.control, borderWidth: 1, borderColor: palette.line,
    backgroundColor: 'rgba(22,25,41,0.6)', color: palette.text, paddingHorizontal: spacing.lg, fontSize: 15,
  },
  focused: { borderColor: palette.accent, shadowColor: palette.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
});
