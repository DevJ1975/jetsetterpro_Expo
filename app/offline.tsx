import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ProgressBar, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { IconWell } from '@/src/features/common/IconWell';
import { convertCurrency } from '@/src/core/api/exchange';
import { fetchWeather } from '@/src/core/api/weather';
import { matchCountry } from '@/src/core/data/countries';
import { languageForCountry, PHRASE_LABELS } from '@/src/core/data/phrasebook';
import { formatDateRange } from '@/src/core/format';
import { useNow } from '@/src/core/useNow';
import { usePreferences } from '@/src/core/store/preferences';
import { useOffline, type OfflineFxRow } from '@/src/core/store/offline';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { useWallet, passesFromTrips } from '@/src/core/store/wallet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Perishable cache (weather / FX) is considered fresh for 48h after prepare. */
const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

function StatusTile({
  icon,
  label,
  value,
  on,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  on: boolean;
}) {
  return (
    <View
      style={{
        flexBasis: '46%',
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: radii.control,
        backgroundColor: palette.elevated,
        borderWidth: 1,
        borderColor: on ? 'rgba(29,185,125,0.35)' : palette.separator,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={13} color={on ? palette.good : palette.faint} />
        <Text style={[type.overline, { fontSize: 9, flex: 1 }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={on ? 'checkmark-circle' : 'close-circle'}
          size={15}
          color={on ? palette.good : palette.faint}
        />
      </View>
      <Text style={[type.body, { fontWeight: '600', marginTop: 6 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function formatRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(1);
  if (rate >= 1) return rate.toFixed(2);
  return rate.toFixed(3);
}

export default function OfflineKitScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const storedPasses = useWallet((s) => s.items);
  const homeCurrency = usePreferences((s) => s.homeCurrency);
  const prepared = useOffline((s) => s.prepared);
  const snapshots = useOffline((s) => s.snapshots);
  const markPrepared = useOffline((s) => s.markPrepared);
  const setSnapshot = useOffline((s) => s.setSnapshot);
  const now = useNow(30_000);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ label: string; value: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );
  const country = matchCountry(trip?.destination);
  const language = languageForCountry(country?.code);
  const passCount = useMemo(
    () => (trip ? passesFromTrips([trip]).length + storedPasses.length : 0),
    [trip, storedPasses],
  );
  const preparedAt = trip ? prepared[trip.id] : undefined;
  const snapshot = trip ? snapshots[trip.id] : undefined;

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Offline Kit" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="cloud-offline" title="No trip yet" subtitle="Add a trip to prepare an offline kit." />
        </View>
      </Screen>
    );
  }

  // ── Freshness countdown (prepare timestamp + 48h window) ───────────────────
  const expiresAt = preparedAt ? new Date(preparedAt).getTime() + FRESH_WINDOW_MS : null;
  const remainingMs = expiresAt != null ? expiresAt - now : null;
  const fresh = remainingMs != null && remainingMs > 0;
  const freshLabel = fresh ? 'Fresh until' : preparedAt ? 'Expired' : 'Fresh until';
  let freshValue = 'Not prepared yet';
  if (remainingMs != null) {
    if (remainingMs > 0) {
      const h = Math.floor(remainingMs / 3_600_000);
      const m = Math.floor((remainingMs % 3_600_000) / 60_000);
      freshValue = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    } else {
      freshValue = 'Refresh before you fly';
    }
  }

  // ── Refresh with per-item progress + partial-failure reporting ─────────────
  const prepare = async () => {
    if (busy) return;
    setBusy(true);
    setWarning(null);
    try {
      setStep({ label: 'Caching destination weather…', value: 0.2 });
      let weatherSummary: string | undefined;
      try {
        const w = await fetchWeather(trip.destination);
        if (w) weatherSummary = `${Math.round(w.tempC)}°C · ${w.description}`;
      } catch {
        // fail soft — reported below
      }

      setStep({ label: 'Caching FX rates…', value: 0.55 });
      const codes = [country?.currency, 'EUR', 'GBP', 'JPY']
        .filter((c): c is string => !!c && c !== homeCurrency)
        .filter((c, i, arr) => arr.indexOf(c) === i)
        .slice(0, 3);
      const fx: OfflineFxRow[] = [];
      for (const code of codes) {
        try {
          const r = await convertCurrency(1, homeCurrency, code);
          if (r) fx.push({ code, rate: r.rate });
        } catch {
          // fail soft — reported below
        }
      }

      setStep({ label: 'Bundling itinerary, wallet & essentials…', value: 0.9 });
      setSnapshot(trip.id, {
        at: new Date().toISOString(),
        weather: weatherSummary,
        fxBase: fx.length ? homeCurrency : undefined,
        fx: fx.length ? fx : undefined,
      });
      markPrepared(trip.id);

      const missing: string[] = [];
      if (!weatherSummary) missing.push('weather');
      if (fx.length === 0) missing.push('exchange rates');
      if (missing.length > 0) {
        setWarning(
          `Cached everything except ${missing.join(' & ')} — connect to Wi-Fi and refresh again to complete your kit.`,
        );
      }
    } finally {
      setStep(null);
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Ready for airplane mode" title="Offline Kit" />

      {/* Trip card */}
      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconWell name="airplane" size={22} style={{ width: 52, height: 52, borderRadius: 14 }} />
          <View style={{ flex: 1 }}>
            <Text style={type.sub} numberOfLines={1}>
              {trip.name}
            </Text>
            <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
              {trip.destination}
            </Text>
            <Text style={[type.caption, { marginTop: 2 }]}>
              {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Status tile grid */}
      <SectionLabel>Cached content</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
        <StatusTile
          icon="list"
          label="Itinerary"
          value={`${trip.items.length} item${trip.items.length === 1 ? '' : 's'}`}
          on={trip.items.length > 0}
        />
        <StatusTile
          icon="wallet"
          label="Wallet"
          value={`${passCount} doc${passCount === 1 ? '' : 's'}`}
          on={passCount > 0}
        />
        <StatusTile
          icon="partly-sunny"
          label="Weather"
          value={snapshot?.weather ?? 'Not cached'}
          on={!!snapshot?.weather}
        />
        <StatusTile
          icon="swap-horizontal"
          label="FX rates"
          value={
            snapshot?.fx?.length
              ? `${snapshot.fx.length} rates (${snapshot.fxBase})`
              : 'Not cached'
          }
          on={!!snapshot?.fx?.length}
        />
        <StatusTile
          icon="globe"
          label="Essentials"
          value={country?.name ?? 'No country match'}
          on={!!country}
        />
        <StatusTile icon="time" label={freshLabel} value={freshValue} on={fresh} />
      </View>

      {/* Cached preview — FX mini-list */}
      {snapshot?.fx?.length ? (
        <>
          <SectionLabel>FX rates</SectionLabel>
          <Card style={{ marginBottom: spacing.lg }}>
            {snapshot.fx.slice(0, 3).map((row, i) => (
              <View
                key={row.code}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderTopColor: palette.line,
                }}
              >
                <Text style={type.body}>1 {snapshot.fxBase}</Text>
                <Text style={[type.body, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                  {formatRate(row.rate)} {row.code}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Cached preview — offline phrases (bundled, always available) */}
      {language ? (
        <>
          <SectionLabel>Offline phrases</SectionLabel>
          <Card style={{ marginBottom: spacing.lg }}>
            {language.lines.slice(0, 3).map((line, i) => (
              <View
                key={PHRASE_LABELS[i]}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.lg,
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderTopColor: palette.line,
                }}
              >
                <Text style={type.bodyDim}>{PHRASE_LABELS[i]}</Text>
                <Text style={[type.body, { fontWeight: '600', flex: 1, textAlign: 'right' }]}>
                  {line.t}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Partial-failure banner */}
      {warning ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.control,
            backgroundColor: palette.fillWarn,
            borderWidth: 1,
            borderColor: 'rgba(232,160,32,0.4)',
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name="wifi" size={16} color={palette.warn} style={{ marginTop: 1 }} />
          <Text style={[type.caption, { color: palette.text, flex: 1 }]}>{warning}</Text>
        </View>
      ) : null}

      <Button
        title={busy ? 'Caching…' : preparedAt ? 'Refresh Offline Kit' : 'Prepare Offline Kit'}
        size="lg"
        onPress={() => void prepare()}
        disabled={busy}
      />
      {step ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <ProgressBar value={step.value} />
          <Text style={[type.caption, { textAlign: 'center' }]}>{step.label}</Text>
        </View>
      ) : (
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
          Itinerary, wallet & essentials are always on-device. Refresh caches weather and FX rates
          for the flight.
        </Text>
      )}
    </Screen>
  );
}
