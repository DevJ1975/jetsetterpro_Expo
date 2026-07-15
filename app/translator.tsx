import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { matchCountry } from '@/src/core/data/countries';
import { LANGUAGES, Language, PHRASE_LABELS, languageForCountry } from '@/src/core/data/phrasebook';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { isTranslateAvailable, useTranslateText } from '@/src/core/api/translate';
import { BackendError } from '@/src/core/api/backend';
import { isScanTextAvailable, scanText } from '@/src/features/translator/scanText';

// iOS TranslatorView parity: language picker button (flag + name) opening a
// sheet, source card, arrow divider, translation card with speak, Translate /
// Scan-with-Camera actions. The bundled phrasebook stays as the offline layer
// below. Deviation: expo-clipboard isn't installed, so the translation is
// long-press selectable instead of having a copy button.

const TRANSLATE_AVAILABLE = isTranslateAvailable();
const SCAN_AVAILABLE = isScanTextAvailable();

export default function TranslatorScreen() {
  const trips = useTravel((s) => s.trips);
  const defaultLang = useMemo(() => {
    const country = matchCountry(activeOrNextTrip(trips)?.destination);
    return languageForCountry(country?.code) ?? LANGUAGES[0];
  }, [trips]);

  const [lang, setLang] = useState<Language>(defaultLang);
  const [source, setSource] = useState('');
  const [translated, setTranslated] = useState('');
  const [detectedSource, setDetectedSource] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const translate = useTranslateText();

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: lang.code });
  };

  const changeLanguage = (l: Language) => {
    setLang(l);
    // Result is per-target; a stale translation for the old target misleads.
    setTranslated('');
    setDetectedSource(undefined);
    setError(null);
  };

  const runTranslate = () => {
    const text = source.trim();
    if (!text || translate.isPending) return;
    setError(null);
    translate.mutate(
      { text, target: lang.code },
      {
        onSuccess: (t) => {
          setTranslated(t.translated);
          setDetectedSource(t.detectedSource);
        },
        onError: (e) => {
          const quota =
            e instanceof BackendError && (e.status === 429 || /quota|limit/i.test(e.code));
          setError(
            quota
              ? 'Translation limit reached — try again later.'
              : "Couldn't translate. Check your connection and try again.",
          );
        },
      },
    );
  };

  const runScan = async () => {
    setError(null);
    const text = await scanText();
    if (text === null) return; // cancelled / denied / unavailable
    if (text.trim()) {
      setSource(text.trim());
      setTranslated('');
      setDetectedSource(undefined);
    } else {
      Alert.alert('No text found', 'Try again with the text well lit and in frame.');
    }
  };

  const clearSource = () => {
    setSource('');
    setTranslated('');
    setDetectedSource(undefined);
    setError(null);
  };

  const detectedLabel = detectedSource
    ? (LANGUAGES.find((l) => l.code === detectedSource)?.name ?? detectedSource.toUpperCase())
    : null;

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={TRANSLATE_AVAILABLE ? 'Live + offline phrasebook' : 'Offline phrasebook'}
        title="Translator"
      />

      {TRANSLATE_AVAILABLE ? (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.xl }}>
          {/* ── Target language picker button ──────────────────────────── */}
          <Pressable onPress={() => setPickerOpen(true)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Text style={{ fontSize: 26 }}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.overline, { fontSize: 9 }]}>Translate into</Text>
                  <Text style={[type.sub, { marginTop: 2 }]}>{lang.name}</Text>
                </View>
                <Ionicons name="chevron-expand" size={16} color={palette.dim} />
              </View>
            </Card>
          </Pressable>

          {/* ── Source ─────────────────────────────────────────────────── */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[type.overline, { color: palette.bright, flex: 1 }]}>Source</Text>
              {source ? (
                <Pressable onPress={clearSource} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={palette.dim} />
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={source}
              onChangeText={setSource}
              placeholder="Type text here, or scan with the camera"
              placeholderTextColor={palette.faint}
              multiline
              style={[type.body, { minHeight: 84, textAlignVertical: 'top', padding: 0 }]}
            />
          </Card>

          <View style={{ alignItems: 'center' }}>
            <Ionicons
              name="arrow-down-circle"
              size={26}
              color={palette.accent}
              style={{ opacity: 0.55 }}
            />
          </View>

          {/* ── Translation ────────────────────────────────────────────── */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[type.overline, { color: palette.good, flex: 1 }]}>Translation</Text>
              {translate.isPending ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : translated ? (
                <Pressable onPress={() => speak(translated)} hitSlop={8}>
                  <Ionicons name="volume-high" size={20} color={palette.bright} />
                </Pressable>
              ) : null}
            </View>
            {translated ? (
              <>
                <Text selectable style={type.body}>
                  {translated}
                </Text>
                {detectedLabel ? (
                  <Text style={[type.caption, { color: palette.faint, marginTop: spacing.sm }]}>
                    Detected: {detectedLabel}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[type.body, { color: palette.faint, minHeight: 60 }]}>
                Translation appears here
              </Text>
            )}
          </Card>

          {error ? (
            <Text style={[type.caption, { color: palette.bad, textAlign: 'center' }]}>{error}</Text>
          ) : null}

          {/* ── Actions ────────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {SCAN_AVAILABLE ? (
              <Button
                title="Scan with Camera"
                variant="secondary"
                onPress={() => void runScan()}
                icon={<Ionicons name="camera" size={16} color={palette.bright} />}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              title={translate.isPending ? 'Translating…' : 'Translate'}
              onPress={runTranslate}
              disabled={!source.trim() || translate.isPending}
              icon={<Ionicons name="globe-outline" size={16} color="#04101F" />}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {/* ── Offline phrasebook (kept as the always-available layer) ─────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        {LANGUAGES.map((l) => {
          const active = l.code === lang.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => changeLanguage(l)}
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
              <Text
                style={{ color: active ? palette.bright : palette.dim, fontWeight: '600', fontSize: 13 }}
              >
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
                {line.p ? (
                  <Text style={[type.caption, { color: palette.faint, marginTop: 1 }]}>{line.p}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => speak(line.t)} hitSlop={8}>
                <Ionicons name="volume-high" size={22} color={palette.bright} />
              </Pressable>
            </View>
          ))}
        </Card>
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
          Tap 🔊 to hear it in {lang.name}.
        </Text>
      </View>

      {/* ── Language picker sheet (iOS LanguagePickerSheet) ─────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View
            style={{
              backgroundColor: palette.elevated,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              paddingTop: spacing.xl,
              paddingBottom: spacing.xxxl,
              maxHeight: '75%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.xl,
                marginBottom: spacing.md,
              }}
            >
              <Text style={[type.sub, { flex: 1 }]}>Target language</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                <Text style={[type.body, { color: palette.bright }]}>Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              {LANGUAGES.map((l, i) => {
                const active = l.code === lang.code;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => {
                      changeLanguage(l);
                      setPickerOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: 14,
                      borderBottomWidth: i === LANGUAGES.length - 1 ? 0 : 0.5,
                      borderBottomColor: palette.separator,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                    <Text style={[type.body, { flex: 1 }]}>{l.name}</Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
