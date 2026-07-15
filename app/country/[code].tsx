import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useState } from 'react';
import { Clipboard, Linking, Pressable, Text, View } from 'react-native';
import { Badge, Card, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { COUNTRIES, VISA_META, type CountryInfo } from '@/src/core/data/countries';
import { languageForCountry, PHRASE_LABELS } from '@/src/core/data/phrasebook';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** iOS cardWrapper: tinted icon + tracked uppercase label above the content. */
function TintedHeader({ icon, label, tint }: { icon: IoniconName; label: string; tint: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
      <Ionicons name={icon} size={13} color={tint} />
      <Text style={[type.overline, { color: tint }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: spacing.lg }}>
      <Text style={[type.body, { color: palette.dim }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

/** Emergency tap-to-dial row: tap dials, long-press copies (iOS context menu). */
function CallRow({
  label,
  number,
  primary,
  onDial,
  onCopy,
}: {
  label: string;
  number: string;
  primary?: boolean;
  onDial: (n: string) => void;
  onCopy: (n: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onDial(number)}
      onLongPress={() => onCopy(number)}
      accessibilityLabel={`Call ${label}, ${number}`}
      accessibilityHint="Double tap to dial. Touch and hold to copy the number."
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={type.body}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: radii.pill,
          backgroundColor: primary ? palette.bad : palette.fillBad,
        }}
      >
        <Ionicons name="call" size={12} color={primary ? '#FFF' : palette.bad} />
        <Text
          style={{
            color: primary ? '#FFF' : palette.bad,
            fontSize: 14,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {number}
        </Text>
      </View>
    </Pressable>
  );
}

/** True when the destination shares North America's Type A/B, ~120V standard. */
function sameAsNorthAmerica(c: CountryInfo): boolean {
  const t = c.plugTypes ?? [];
  return t.includes('A') && t.includes('B') && /\b1\d{2}V/.test(c.plug);
}

export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const c = COUNTRIES.find((x) => x.code === code);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!c) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Country" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="globe" title="Not found" />
        </View>
      </Screen>
    );
  }

  const copy = (number: string) => {
    Clipboard.setString(number);
    setCopied(number);
  };

  // Dialer hand-off: strip everything the dialer can't take (spaces, hyphens,
  // parentheses) so multi-part hotlines still produce a valid tel: URL; fall
  // back to copying when the number can't be dialed (simulator, no cellular).
  const dial = (number: string) => {
    const sanitized = number.replace(/[^\d+]/g, '');
    if (!sanitized) {
      copy(number);
      return;
    }
    Linking.openURL(`tel:${sanitized}`).catch(() => copy(number));
  };

  const speak = (text: string, lang: string) => {
    Speech.stop();
    Speech.speak(text, { language: lang });
  };

  const visa = VISA_META[c.visa.status];
  const voltage = c.plug.split('·')[1]?.trim() ?? c.plug;
  const emg = c.emergencyNumbers;
  const language = languageForCountry(c.code);
  const waterSafe = c.waterSafe;

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
        <BackHeader title="Travel Essentials" />

        {/* Hero — 72pt flag + name + region caption */}
        <View style={{ alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.lg }}>
          <Text style={{ fontSize: 72, lineHeight: 84 }}>{c.flag}</Text>
          <Text style={[type.title, { marginTop: spacing.xs }]}>{c.name}</Text>
          {c.region ? (
            <Text style={[type.caption, { marginTop: 2 }]}>
              {c.region} · {c.currency}
            </Text>
          ) : null}
        </View>

        {/* Visa badge row → full visa detail */}
        <Card variant="glass" style={{ marginBottom: spacing.lg }}>
          <Pressable
            onPress={() => router.push({ pathname: '/visa', params: { code: c.code } })}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <SectionLabel>Entry · US passport</SectionLabel>
              </View>
              <Badge tone={visa.tone} label={visa.label} />
            </View>
            {c.visa.stay ? <Text style={type.body}>Allowed stay: {c.visa.stay}</Text> : null}
            {c.visa.note ? <Text style={[type.bodyDim, { marginTop: 2 }]}>{c.visa.note}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
              <Text style={[type.caption, { color: palette.bright }]}>Full requirements</Text>
              <Ionicons name="chevron-forward" size={12} color={palette.bright} />
            </View>
          </Pressable>
        </Card>

        {/* EMERGENCY */}
        <Card style={{ marginBottom: spacing.lg }}>
          <TintedHeader icon="warning" label="Emergency" tint={palette.bad} />
          {emg ? (
            <View>
              {emg.general ? (
                <CallRow label="All Services" number={emg.general} primary onDial={dial} onCopy={copy} />
              ) : null}
              <CallRow label="Police" number={emg.police} onDial={dial} onCopy={copy} />
              <CallRow label="Ambulance" number={emg.ambulance} onDial={dial} onCopy={copy} />
              <CallRow label="Fire" number={emg.fire} onDial={dial} onCopy={copy} />
              {emg.touristHotline ? (
                <CallRow label="Tourist Help" number={emg.touristHotline} onDial={dial} onCopy={copy} />
              ) : null}
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Tap to dial · hold to copy
              </Text>
            </View>
          ) : (
            <Text style={type.heading}>{c.emergency}</Text>
          )}
        </Card>

        {/* TIPPING */}
        <Card style={{ marginBottom: spacing.lg }}>
          <TintedHeader icon="cash" label="Tipping" tint={palette.good} />
          <Text style={type.body}>{c.tipping}</Text>
        </Card>

        {/* ELECTRICAL */}
        <Card style={{ marginBottom: spacing.lg }}>
          <TintedHeader icon="flash" label="Electrical" tint={palette.warn} />
          {c.plugTypes?.length ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {c.plugTypes.map((p) => (
                <View
                  key={p}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.fillWarn,
                    borderWidth: 1,
                    borderColor: 'rgba(232,160,32,0.4)',
                  }}
                >
                  <Text style={{ color: palette.warn, fontSize: 18, fontWeight: '800' }}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <DetailRow label="Voltage" value={voltage} />
          <Text style={[type.caption, { color: palette.warn, marginTop: spacing.xs }]}>
            {c.plugTypes?.length
              ? `Type ${c.plugTypes.join('/')} sockets — compare to your home standard`
              : c.plug}
          </Text>
          {sameAsNorthAmerica(c) ? (
            <Text style={[type.caption, { color: palette.good, marginTop: spacing.xs }]}>
              Same Type A/B plugs used in North America — no adapter needed if that’s your home standard
            </Text>
          ) : null}
        </Card>

        {/* TAP WATER */}
        {waterSafe != null ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <TintedHeader
              icon={waterSafe ? 'shield-checkmark' : 'water'}
              label="Tap water"
              tint={waterSafe ? palette.good : palette.warn}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons
                name={waterSafe ? 'shield-checkmark' : 'alert-circle'}
                size={20}
                color={waterSafe ? palette.good : palette.warn}
              />
              <Text style={[type.sub, { color: waterSafe ? palette.good : palette.warn }]}>
                {waterSafe ? 'Safe to drink' : 'Not safe — use bottled'}
              </Text>
            </View>
            <Text style={[type.caption, { marginTop: spacing.xs }]}>
              {waterSafe
                ? 'Tap water is considered safe to drink here.'
                : 'Stick to bottled or filtered water — including for ice.'}
            </Text>
          </Card>
        ) : null}

        {/* WATCH OUT — common scams */}
        {c.scams?.length ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <TintedHeader icon="eye" label="Watch out" tint={palette.warn} />
            <View style={{ gap: spacing.sm }}>
              {c.scams.map((scam) => (
                <View key={scam} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color={palette.warn}
                    style={{ marginTop: 3 }}
                  />
                  <Text style={[type.body, { flex: 1 }]}>{scam}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* USEFUL PHRASES — full phrasebook set with speech */}
        {language ? (
          <Card>
            <TintedHeader icon="chatbubble-ellipses" label="Useful phrases" tint={palette.accent} />
            {language.lines.map((line, i) => (
              <View
                key={PHRASE_LABELS[i]}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderTopColor: palette.line,
                }}
              >
                <Text style={type.caption}>{PHRASE_LABELS[i]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
                  <Text style={[type.sub, { flex: 1 }]}>{line.t}</Text>
                  {line.p ? (
                    <Text style={[type.caption, { color: palette.bright, fontStyle: 'italic' }]}>
                      {line.p}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => speak(line.t, language.code)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Speak phrase"
                  >
                    <Ionicons name="volume-high" size={18} color={palette.accent} />
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <TintedHeader icon="chatbubble-ellipses" label="Useful phrases" tint={palette.accent} />
            <DetailRow label="Hello" value={c.phrases.hello} />
            <DetailRow label="Thank you" value={c.phrases.thanks} />
            <DetailRow label="Help" value={c.phrases.help} />
          </Card>
        )}
      </Screen>

      {/* Copy confirmation toast */}
      {copied ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 40,
            alignSelf: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: 10,
            borderRadius: radii.pill,
            backgroundColor: palette.elevated2,
            borderWidth: 1,
            borderColor: palette.lineStrong,
          }}
        >
          <Text style={[type.caption, { color: palette.text }]}>Copied {copied}</Text>
        </View>
      ) : null}
    </View>
  );
}
