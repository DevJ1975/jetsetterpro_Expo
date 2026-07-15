import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, radii, spacing, type } from '@/src/ui';
import type { IoniconName } from './content';

/**
 * Final onboarding page — port of the iOS `setupPage`: personalization header,
 * icon-led "premium input" fields for name and home airport (with live IATA
 * validation), and a row that opens the currency picker. All fields are
 * optional; state lives in the parent so Get Started can commit atomically.
 */
export function SetupPage({
  width,
  name,
  onNameChange,
  airport,
  onAirportChange,
  airportValid,
  currencyLabel,
  onOpenCurrency,
}: {
  width: number;
  name: string;
  onNameChange: (t: string) => void;
  airport: string;
  onAirportChange: (t: string) => void;
  airportValid: boolean;
  currencyLabel: string;
  onOpenCurrency: () => void;
}) {
  return (
    <View style={{ width }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-circle" size={44} color={palette.champagne} />
          </View>
          <Text style={[type.title, styles.centered]}>
            {'Let’s Personalize\nYour Experience'}
          </Text>
          <Text style={styles.blurb}>
            Tell us a bit about yourself to tailor JetSetter Pro to your travel style.
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <Field
            icon="person"
            placeholder="Your name"
            value={name}
            onChangeText={onNameChange}
            autoCapitalize="words"
          />

          <View style={{ gap: 6 }}>
            <Field
              icon="airplane"
              placeholder="Home airport (IATA code)"
              value={airport}
              onChangeText={onAirportChange}
              autoCapitalize="characters"
            />
            {/* A real IATA code is exactly three A–Z letters. Surface the iOS
                warning the moment the field holds something that can't be a
                code, so a typo or city name is caught before Get Started. */}
            {airport.length > 0 && !airportValid ? (
              <Text style={[styles.hint, { color: palette.warn }]}>
                Enter a 3-letter airport code, like JFK or ORD.
              </Text>
            ) : (
              <Text style={styles.hint}>3-letter code, e.g. JFK</Text>
            )}
          </View>

          <Pressable
            onPress={onOpenCurrency}
            accessibilityRole="button"
            accessibilityLabel={`Currency, ${currencyLabel}`}
            style={({ pressed }) => [styles.inputRow, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="cash" size={18} color={palette.accent} style={styles.inputIcon} />
            <Text style={[type.body, { flex: 1 }]}>{currencyLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  autoCapitalize,
}: {
  icon: IoniconName;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize: 'words' | 'characters';
}) {
  return (
    <View style={styles.inputRow}>
      <Ionicons name={icon} size={18} color={palette.accent} style={styles.inputIcon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.35)"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        selectionColor={palette.accent}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 32,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,158,240,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,158,240,0.30)',
  },
  centered: {
    textAlign: 'center',
  },
  blurb: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputIcon: {
    width: 20,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
    paddingVertical: 0,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.faint,
    paddingLeft: 4,
  },
});
