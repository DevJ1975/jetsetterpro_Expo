import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, palette, spacing, type } from '@/src/ui';

/**
 * "From the founder" card — port of iOS `AboutView.founderCard`: circular
 * gold-edged headshot with an accent glow, an italic pull-quote, and the
 * founder title + company lines.
 */
export function FounderCard() {
  return (
    <Card variant="glass">
      <View style={styles.body}>
        <View style={styles.avatarGlow}>
          <Image
            source={require('../../../assets/showcase/founder-headshot.png')}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
            accessibilityLabel="Founder headshot"
          />
        </View>

        <Text style={styles.quote}>
          {'“We built JetSetter Pro for people who live on the road — so the app handles the delays, the rebookings and the logistics, and you just travel like an executive.”'}
        </Text>

        <View style={styles.byline}>
          <Text style={styles.role}>Founder & CEO</Text>
          <Text style={type.caption}>Trainovate Technologies LLC</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  avatarGlow: {
    borderRadius: 44,
    shadowColor: palette.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(220,166,70,0.6)',
  },
  quote: {
    fontSize: 15,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
    color: palette.text,
  },
  byline: {
    alignItems: 'center',
    gap: 2,
  },
  role: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accent,
  },
});
