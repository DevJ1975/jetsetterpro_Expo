import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Badge, Button, Card, Input, SectionLabel, StatusDot, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { Chips } from '@/src/features/common/Chips';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import {
  markDisruptionRead,
  useDisruptions,
  type DisruptionEvent,
  type DisruptionKind,
} from '@/src/core/api/disruptions';
import { statusLabel, statusTone, useFlightStatus } from '@/src/core/api/flights';
import { formatTime } from '@/src/core/format';
import { estimateCompensation, Region } from '@/src/core/services/compensation';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Kind → icon/tone/actions, mirroring the iOS DisruptionType presentation
// (clock for delays, swap for gate changes, hard-stop red for cancel/divert).
const KIND_META: Record<
  DisruptionKind,
  { icon: IoniconName; color: string; fill: string; rebook: boolean; hotel: boolean }
> = {
  DELAY: { icon: 'time', color: palette.warn, fill: palette.fillWarn, rebook: true, hotel: true },
  GATE_CHANGE: {
    icon: 'swap-horizontal',
    color: palette.accent,
    fill: palette.fillAccent,
    rebook: false,
    hotel: false,
  },
  CANCELLED: { icon: 'close-circle', color: palette.bad, fill: palette.fillBad, rebook: true, hotel: true },
  DIVERTED: { icon: 'shuffle', color: palette.bad, fill: palette.fillBad, rebook: true, hotel: true },
};

function timeAgo(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function openRebook(ident: string) {
  const q = encodeURIComponent(`flights ${ident}`);
  WebBrowser.openBrowserAsync(`https://www.google.com/travel/flights?q=${q}`).catch(() => {});
}

function notifyHotel(event: DisruptionEvent) {
  const situation =
    event.kind === 'CANCELLED'
      ? `my flight ${event.ident} was cancelled and I'm arranging alternative travel, so my arrival time is uncertain`
      : event.kind === 'DIVERTED'
        ? `my flight ${event.ident} was diverted, so my arrival time is uncertain`
        : `my flight ${event.ident} is delayed${event.delta?.delayMin ? ` by ~${event.delta.delayMin} min` : ''}, so I expect to arrive later than planned`;
  const body = encodeURIComponent(
    `Hello — ${situation}. Kindly hold my reservation; I'll confirm once I land. (Sent via JetSetter Pro)`,
  );
  // iOS wants `sms:&body=`, Android `sms:?body=` (existing sms: pattern).
  Linking.openURL(Platform.OS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`).catch(() => {});
}

function DisruptionEventCard({ event, now }: { event: DisruptionEvent; now: number }) {
  const meta = KIND_META[event.kind];
  return (
    <Card variant="glass" style={{ marginTop: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: meta.fill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={meta.icon} size={19} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.sub} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={[type.caption, { marginTop: 1 }]} numberOfLines={1}>
            {event.ident} · {timeAgo(event.createdAt, now)}
          </Text>
        </View>
        {event.delta?.delayMin ? (
          <Text style={[type.stat, { color: palette.warn }]}>+{event.delta.delayMin}m</Text>
        ) : event.delta?.gate ? (
          <Text style={[type.sub, { color: palette.bright }]}>
            {event.delta.gate[0]} → {event.delta.gate[1]}
          </Text>
        ) : null}
      </View>

      <Text style={type.bodyDim}>{event.message}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {meta.rebook ? (
          <Button title="Rebook" size="sm" onPress={() => openRebook(event.ident)} />
        ) : null}
        {meta.hotel ? (
          <Button title="Notify hotel" variant="secondary" size="sm" onPress={() => notifyHotel(event)} />
        ) : null}
        <Button
          title="Mark handled"
          variant="ghost"
          size="sm"
          onPress={() => void markDisruptionRead(event.id)}
        />
      </View>
    </Card>
  );
}

function ResolvedRow({ event, now, last }: { event: DisruptionEvent; now: number; last: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.separator,
        opacity: 0.55,
      }}
    >
      <Ionicons name="checkmark-circle" size={20} color={palette.good} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.body} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[type.caption, { marginTop: 1 }]} numberOfLines={1}>
          {event.ident} · {event.message}
        </Text>
      </View>
      <Text style={type.caption}>{timeAgo(event.createdAt, now)}</Text>
    </View>
  );
}

function SectionHeader({ icon, color, label }: { icon: IoniconName; color: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
        marginBottom: spacing.xs,
      }}
    >
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[type.overline, { color }]}>{label}</Text>
    </View>
  );
}

export default function DisruptionScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const now = useNow(30_000);

  // Live status for the next flight — the real pill instead of hardcoded "On time".
  const ident = flight ? extractFlightNumber(flight.item.title) : null;
  const status = useFlightStatus(ident, flight?.item.startDate.slice(0, 10) ?? null);

  // Live disruption event feed (written server-side every 10 min).
  const events = useDisruptions();
  const active = useMemo(() => events.filter((e) => !e.readAt), [events]);
  const resolved = useMemo(() => events.filter((e) => Boolean(e.readAt)), [events]);

  // Compensation calculator state.
  const [region, setRegion] = useState<Region>('EU');
  const [intraEu, setIntraEu] = useState<'yes' | 'no'>('no');
  const [delay, setDelay] = useState('3.5');
  const [distance, setDistance] = useState('2500');
  const comp = useMemo(
    () =>
      estimateCompensation({
        region,
        intraEu: region === 'EU' && intraEu === 'yes',
        delayHours: parseFloat(delay) || 0,
        distanceKm: parseFloat(distance) || 0,
      }),
    [region, intraEu, delay, distance],
  );

  const liveCode = status.data?.status ?? 'unknown';
  const liveTone = statusTone(liveCode);
  const dotTone = liveTone === 'neutral' ? 'accent' : liveTone;
  const gate = status.data?.origin.gate;
  const depIso = status.data?.origin.times.estimated ?? status.data?.origin.times.scheduled;

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Delay & cancel monitoring" title="Trip Disruption" />
      <PremiumGate feature="Trip Disruption AI">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {!flight ? (
            <Card variant="glass">
              <EmptyState
                icon="warning"
                title="No flights to monitor"
                subtitle="Add a flight and IRIS will watch it for delays and cancellations."
              />
            </Card>
          ) : (
            <Card variant="glass" style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <StatusDot tone={dotTone} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.sub} numberOfLines={1}>
                    {flight.item.title}
                  </Text>
                  <Text style={[type.bodyDim, { marginTop: 2 }]} numberOfLines={1}>
                    {status.data
                      ? `${gate ? `Gate ${gate} · ` : ''}Departs ${formatTime(depIso ?? flight.item.startDate)}`
                      : 'Monitoring for delays, gate changes and cancellations'}
                  </Text>
                </View>
                <Badge
                  tone={status.data ? liveTone : 'neutral'}
                  label={status.data ? statusLabel(liveCode, status.data.delayMin) : 'Monitoring'}
                />
              </View>
            </Card>
          )}

          {active.length > 0 ? (
            <>
              <SectionHeader
                icon="warning"
                color={palette.bad}
                label={`${active.length} active disruption${active.length === 1 ? '' : 's'}`}
              />
              {active.map((e) => (
                <DisruptionEventCard key={e.id} event={e} now={now} />
              ))}
            </>
          ) : null}

          {resolved.length > 0 ? (
            <>
              <SectionHeader icon="checkmark-circle" color={palette.good} label="Resolved" />
              <Card style={{ marginTop: spacing.md }}>
                {resolved.map((e, i) => (
                  <ResolvedRow key={e.id} event={e} now={now} last={i === resolved.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          {flight && active.length === 0 && resolved.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: palette.fillGood,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="shield-checkmark" size={44} color={palette.good} />
              </View>
              <Text style={[type.heading, { marginTop: spacing.sm }]}>All Flights On Track</Text>
              <Text style={[type.caption, { textAlign: 'center', maxWidth: 300 }]}>
                No disruptions detected. Your active trips are checked in the background and you
                get alerted the moment something changes.
              </Text>
            </View>
          ) : null}

          <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
            <SectionLabel>Know your rights</SectionLabel>
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.overline, { color: '#8B92A8' }]}>Route region</Text>
              <Chips
                options={['EU', 'US', 'other'] as Region[]}
                value={region}
                onChange={setRegion}
                labelOf={(r) => (r === 'EU' ? 'EU / EEA' : r === 'US' ? 'US' : 'Other')}
              />
            </View>
            {region === 'EU' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[type.overline, { color: '#8B92A8' }]}>Both airports in EU/EEA?</Text>
                <Chips
                  options={['no', 'yes'] as ('no' | 'yes')[]}
                  value={intraEu}
                  onChange={setIntraEu}
                  labelOf={(v) => (v === 'yes' ? 'Yes (intra-EU)' : 'No')}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input label="Delay (hours)" value={delay} onChangeText={setDelay} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Input label="Distance (km)" value={distance} onChangeText={setDistance} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons
                name={comp.eligible ? 'cash' : 'information-circle'}
                size={24}
                color={comp.eligible ? palette.good : palette.dim}
              />
              <Text style={[type.heading, { color: comp.eligible ? palette.good : palette.dim }]}>
                {comp.amount ? `€${comp.amount.value}` : comp.eligible ? 'Refund owed' : 'No fixed payout'}
              </Text>
            </View>
            <Text style={type.bodyDim}>{comp.note}</Text>
          </Card>

          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            Monitored every 10 minutes server-side · push alerts on changes
          </Text>
        </View>
      </PremiumGate>
    </Screen>
  );
}
