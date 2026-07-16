import Constants from 'expo-constants';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing } from '@/src/ui';

// App-wide footer: beta tag + version, and the maker credit. Rendered at the
// bottom of the primary browse surfaces (More tab, About). Version comes from
// app.json via expo-constants so it tracks each release automatically.
const VERSION = Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? '1.0.0';

export function AppFooter({ style }: { style?: object }) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="summary">
      <Text style={styles.version} accessibilityLabel={`Beta, version ${VERSION}`}>
        Beta · v{VERSION}
      </Text>
      <Text style={styles.credit}>Made with ♥ from Las Vegas by Trainovate Technologies</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xl,
  },
  version: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: palette.faint,
  },
  credit: {
    fontSize: 11,
    color: palette.faint,
    textAlign: 'center',
  },
});
