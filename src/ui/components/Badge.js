import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radii } from '../theme';

const TONES = {
  accent: { bg: palette.fillAccent, border: palette.lineStrong, text: palette.bright },
  good:   { bg: palette.fillGood, border: 'rgba(29,185,125,0.4)', text: palette.good },
  warn:   { bg: palette.fillWarn, border: 'rgba(232,160,32,0.4)', text: palette.warn },
  bad:    { bg: palette.fillBad, border: 'rgba(232,64,64,0.4)', text: palette.bad },
  neutral:{ bg: 'rgba(139,146,168,0.12)', border: 'rgba(139,146,168,0.3)', text: palette.dim },
};

/** Small uppercase status pill: <Badge tone="bad" label="+3H 35M" /> */
export default function Badge({ label, tone = 'accent', style }) {
  const t = TONES[tone] || TONES.accent;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
