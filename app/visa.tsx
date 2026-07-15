import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, Input, ListRow, ProgressBar, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import {
  COUNTRIES,
  VISA_META,
  flagEmoji,
  matchCountry,
  type CountryInfo,
  type VisaStatus,
} from '@/src/core/data/countries';
import { useNow } from '@/src/core/useNow';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import {
  countSchengenDays,
  isSchengen,
  SCHENGEN_ALLOWANCE_DAYS,
} from '@/src/features/essentials/schengen';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STATE_GOV_URL =
  'https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages.html';

/** Picker group order — mirrors the iOS DestinationPickerSheet sections. */
const KIND_ORDER: VisaStatus[] = ['visa-free', 'eTA', 'eVisa', 'on-arrival', 'required'];

const KIND_ICON: Record<VisaStatus, IoniconName> = {
  'visa-free': 'shield-checkmark',
  eTA: 'globe',
  eVisa: 'globe-outline',
  'on-arrival': 'airplane',
  required: 'document-text',
  home: 'home',
};

const TONE_COLOR: Record<string, string> = {
  good: palette.good,
  accent: palette.accent,
  warn: palette.warn,
  bad: palette.bad,
  neutral: palette.dim,
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: spacing.lg }}>
      <Text style={[type.body, { color: palette.dim }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

export default function VisaScreen() {
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const trips = useTravel((s) => s.trips);
  const now = useNow(60_000);

  // Auto-select the pushed country, else the next trip's destination. Never
  // fall back to an arbitrary country — wrong entry requirements are dangerous.
  const [selectedCode, setSelectedCode] = useState<string | undefined>(() => {
    if (codeParam && COUNTRIES.some((c) => c.code === codeParam && c.visa.status !== 'home')) {
      return codeParam;
    }
    const m = matchCountry(activeOrNextTrip(trips)?.destination);
    return m && m.visa.status !== 'home' ? m.code : undefined;
  });
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');

  const selected = COUNTRIES.find((c) => c.code === selectedCode);
  const showPicker = picking || !selected;

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = COUNTRIES.filter(
      (c) => c.visa.status !== 'home' && (!q || c.name.toLowerCase().includes(q)),
    );
    return KIND_ORDER.map((kind) => ({
      kind,
      items: rows.filter((c) => c.visa.status === kind),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const schengen = useMemo(
    () => (selected && isSchengen(selected.code) ? countSchengenDays(trips, new Date(now)) : null),
    [selected, trips, now],
  );

  const pick = (c: CountryInfo) => {
    setSelectedCode(c.code);
    setPicking(false);
    setSearch('');
  };

  const openStateGov = () => {
    WebBrowser.openBrowserAsync(STATE_GOV_URL).catch(() => {});
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="US passport" title="Visa Requirements" />

      {selected && !showPicker ? (
        <VisaDetailBody
          country={selected}
          schengen={schengen}
          onChangeDestination={() => setPicking(true)}
          onOpenStateGov={openStateGov}
        />
      ) : (
        <>
          {!selected ? (
            <Card variant="glass" style={{ marginBottom: spacing.lg }}>
              <SectionLabel>Select a destination</SectionLabel>
              <Text style={type.bodyDim}>
                Choose a country to see visa and entry requirements for US passport holders.
              </Text>
            </Card>
          ) : null}

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <SectionLabel style={{ marginBottom: 0 }}>By requirement</SectionLabel>
              </View>
              {selected ? (
                <Pressable onPress={() => setPicking(false)} hitSlop={8}>
                  <Text style={[type.caption, { color: palette.bright }]}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
            <Input
              placeholder="Search destinations"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              style={{ marginBottom: spacing.md }}
            />
            {groups.map((g) => {
              const meta = VISA_META[g.kind];
              return (
                <View key={g.kind} style={{ marginBottom: spacing.md }}>
                  <SectionLabel>{meta.label}</SectionLabel>
                  {g.items.map((c, i) => (
                    <ListRow
                      key={c.code}
                      last={i === g.items.length - 1}
                      icon={<Text style={{ fontSize: 22 }}>{c.flag}</Text>}
                      title={c.name}
                      subtitle={c.visa.stay ? `Up to ${c.visa.stay}` : c.visa.note}
                      right={
                        c.code === selectedCode ? (
                          <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
                        ) : (
                          <Badge tone={meta.tone} label={meta.label} />
                        )
                      }
                      onPress={() => pick(c)}
                    />
                  ))}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

function VisaDetailBody({
  country: c,
  schengen,
  onChangeDestination,
  onOpenStateGov,
}: {
  country: CountryInfo;
  schengen: { used: number; remaining: number } | null;
  onChangeDestination: () => void;
  onOpenStateGov: () => void;
}) {
  const meta = VISA_META[c.visa.status];
  const tint = TONE_COLOR[meta.tone] ?? palette.accent;
  const detail = c.visaDetail;

  return (
    <>
      {/* Hero — 64pt flag, "For US passport holders" */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.lg }}>
        <Text style={{ fontSize: 64, lineHeight: 76 }}>{flagEmoji(c.code)}</Text>
        <Text style={[type.title, { marginTop: spacing.xs }]}>{c.name}</Text>
        <Text style={[type.caption, { marginTop: 2 }]}>For US passport holders</Text>
        <Pressable
          onPress={onChangeDestination}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.md,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radii.pill,
              backgroundColor: palette.fillAccent,
              borderWidth: 1,
              borderColor: palette.line,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="globe-outline" size={13} color={palette.bright} />
          <Text style={[type.caption, { color: palette.bright, fontWeight: '700' }]}>
            Change destination
          </Text>
        </Pressable>
      </View>

      {/* REQUIREMENT — color-coded by kind */}
      <Card
        variant="outline"
        style={{
          borderColor: `${tint}55`,
          backgroundColor: 'rgba(22,25,41,0.55)',
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
          <Ionicons name={KIND_ICON[c.visa.status]} size={18} color={tint} />
          <Text style={[type.overline, { color: tint }]}>{meta.label}</Text>
        </View>
        <DetailRow
          label="Max stay"
          value={
            detail?.maxStay != null
              ? `${detail.maxStay} days`
              : (c.visa.stay ?? 'Per visa terms')
          }
        />
        <DetailRow label="Fee" value={detail?.fee ?? 'None'} />
        {detail?.onwardTicket ? <DetailRow label="Onward ticket" value="Required" /> : null}
        {c.visa.note ? (
          <Text style={[type.caption, { marginTop: spacing.xs }]}>{c.visa.note}</Text>
        ) : null}
      </Card>

      {/* PASSPORT */}
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionLabel>Passport</SectionLabel>
        <DetailRow
          label="Validity required"
          value={
            detail?.passportValidityMonths != null
              ? detail.passportValidityMonths === 0
                ? 'Valid through stay'
                : `${detail.passportValidityMonths} months after entry`
              : '—'
          }
        />
        <DetailRow
          label="Blank pages required"
          value={detail?.blankPages != null ? String(detail.blankPages) : '—'}
        />
      </Card>

      {/* SCHENGEN 90/180 — computed from saved trips */}
      {schengen ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Schengen 90/180</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text style={type.stat}>{schengen.remaining}</Text>
            <Text style={type.bodyDim}>of {SCHENGEN_ALLOWANCE_DAYS} days left</Text>
          </View>
          <ProgressBar
            value={schengen.used / SCHENGEN_ALLOWANCE_DAYS}
            style={{ marginTop: spacing.md }}
          />
          <Text style={[type.caption, { marginTop: spacing.md }]}>
            {schengen.used} day{schengen.used === 1 ? '' : 's'} used — shared across all Schengen
            states in any rolling 180-day window, based on your saved trips.
          </Text>
        </Card>
      ) : null}

      {/* Disclaimer → travel.state.gov */}
      <Pressable onPress={onOpenStateGov} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
        <Card variant="outline">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="shield-half" size={20} color={palette.warn} />
            <View style={{ flex: 1 }}>
              <Text style={type.sub}>Always verify with the State Department</Text>
              <Text style={[type.caption, { marginTop: 2 }]}>
                Requirements change. Open travel.state.gov →
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={palette.bright} />
          </View>
        </Card>
      </Pressable>
    </>
  );
}
