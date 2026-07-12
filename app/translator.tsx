import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { matchCountry } from '@/src/core/data/countries';
import { LANGUAGES, Language, PHRASE_LABELS, languageForCountry } from '@/src/core/data/phrasebook';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';

export default function TranslatorScreen() {
  const trips = useTravel((s) => s.trips);
  const defaultLang = useMemo(() => {
    const country = matchCountry(activeOrNextTrip(trips)?.destination);
    return languageForCountry(country?.code) ?? LANGUAGES[0];
  }, [trips]);

  const [lang, setLang] = useState<Language>(defaultLang);

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: lang.code });
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Offline phrasebook" title="Translator" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md }}
      >
        {LANGUAGES.map((l) => {
          const active = l.code === lang.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => setLang(l)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? palette.accent : palette.line,
                backgroundColor: active ? palette.fillAccent : 'transparent',
              }}
            >
              <Text style={{ fontSize: 16 }}>{l.flag}</Text>
              <Text style={{ color: active ? palette.bright : palette.dim, fontWeight: '600', fontSize: 13 }}>
                {l.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Card>
          <SectionLabel>Essential phrases</SectionLabel>
          {lang.lines.map((line, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 12,
                borderBottomWidth: i === lang.lines.length - 1 ? 0 : 0.5,
                borderBottomColor: palette.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: palette.dim }]}>{PHRASE_LABELS[i]}</Text>
                <Text style={[type.sub, { marginTop: 2 }]}>{line.t}</Text>
                {line.p ? <Text style={[type.caption, { color: palette.faint, marginTop: 1 }]}>{line.p}</Text> : null}
              </View>
              <Pressable onPress={() => speak(line.t)} hitSlop={8}>
                <Ionicons name="volume-high" size={22} color={palette.bright} />
              </Pressable>
            </View>
          ))}
        </Card>
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
          Tap 🔊 to hear it. Free-form + camera translation connect with an on-device model in a later update.
        </Text>
      </View>
    </Screen>
  );
}
