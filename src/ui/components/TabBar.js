import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { palette } from '../theme';

/**
 * Bottom tab bar. tabs: [{ key, label, icon: (active) => node }]
 * Pair with your navigator (e.g. React Navigation's tabBar prop).
 */
export default function TabBar({ tabs, activeKey, onChange }) {
  return (
    <View style={styles.bar}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab}>
            {t.icon ? t.icon(active) : null}
            <Text style={[styles.label, { color: active ? palette.bright : palette.faint }]}>{t.label}</Text>
            {active ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: 'rgba(10,13,22,0.96)',
    borderTopWidth: 1, borderTopColor: palette.line,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12, paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.bright, marginTop: 1 },
});
