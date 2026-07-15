import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Badge, Button, Card, Input, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { Chips } from '@/src/features/common/Chips';
import { LiveConditionsCard } from '@/src/features/departure/LiveConditionsCard';
import { RideshareCard } from '@/src/features/departure/RideshareCard';
import { RouteMapPreview } from '@/src/features/departure/RouteMapPreview';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { statusLabel, statusTone, useFlightStatus } from '@/src/core/api/flights';
import { estimateSecurityWait, type SecurityLane } from '@/src/core/api/tsa';
import { parseRoute } from '@/src/core/flightPhase';
import { formatDate, formatTime } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';

const LANE_LABEL: Record<SecurityLane, string> = {
  standard: 'Standard',
  preCheck: 'PreCheck',
  clear: 'CLEAR',
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// iOS DepartureRecommendation.Urgency — label + tone per minutes of runway.
function urgencyOf(minsUntil: number): { label: string; color: string } {
  if (minsUntil < 0) return { label: 'Departure window passed', color: palette.bad };
  if (minsUntil < 10) return { label: 'Leave now!', color: palette.bad };
  if (minsUntil < 30) return { label: 'Cutting it close', color: palette.warn };
  if (minsUntil < 60) return { label: 'On schedule', color: palette.bright };
  return { label: 'Plenty of time', color: palette.good };
}

function MilestoneRow({
  icon,
  title,
  note,
  time,
  color = palette.text,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  note?: string;
  time: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.separator,
      }}
    >
      <Ionicons name={icon} size={16} color={palette.bright} style={{ width: 20 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.body} numberOfLines={1}>
          {title}
        </Text>
        {note ? (
          <Text style={[type.caption, { marginTop: 1 }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontFamily: MONO, fontSize: 15, fontWeight: '700', color }}>{time}</Text>
    </View>
  );
}

export default function DepartureOptimizerScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);

  const [drive, setDrive] = useState('30');
  const [lane, setLane] = useState<SecurityLane>('preCheck');
  const [intl, setIntl] = useState<'domestic' | 'international'>('domestic');
  const [reminder, setReminder] = useState<{ state: 'idle' | 'set' | 'denied'; at?: string }>({
    state: 'idle',
  });
  const now = useNow(60_000); // live "leave by" countdown, refreshed each minute

  const ident = flight ? extractFlightNumber(flight.item.title) : null;
  const route = flight ? parseRoute(flight.item.title) : null;
  const status = useFlightStatus(ident, flight?.item.startDate.slice(0, 10) ?? null);
  const originIata = route?.origin || status.data?.origin.iata || '';
  const destIata = route?.dest || status.data?.destination.iata || '';
  const gate = status.data?.origin.gate;
  const terminal = status.data?.origin.terminal;

  const result = useMemo(() => {
    if (!flight) return null;
    const depIso =
      status.data?.origin.times.estimated ??
      status.data?.origin.times.scheduled ??
      flight.item.startDate;
    const dep = new Date(depIso);
    const driveMin = Math.max(0, parseInt(drive, 10) || 0);
    // Security estimated for arrival-if-you-left-now (same anchor iOS uses).
    const wait = estimateSecurityWait(originIata || undefined, new Date(now + driveMin * 60_000), lane);
    const walkMin = 15;
    const boardMin = intl === 'international' ? 60 : 30;
    const lead = driveMin + wait.minutes + walkMin + boardMin;
    const leaveByMs = dep.getTime() - lead * 60_000;
    return {
      dep,
      driveMin,
      wait,
      walkMin,
      boardMin,
      lead,
      leaveBy: new Date(leaveByMs),
      enterSecurity: new Date(leaveByMs + driveMin * 60_000),
      walkToGate: new Date(leaveByMs + (driveMin + wait.minutes) * 60_000),
      atGate: new Date(leaveByMs + (driveMin + wait.minutes + walkMin) * 60_000),
      minsUntil: Math.round((leaveByMs - now) / 60_000),
    };
  }, [flight, status.data, drive, lane, intl, now, originIata]);

  const remind = async () => {
    if (!result) return;
    const fireAt = new Date(result.leaveBy.getTime() - 10 * 60_000);
    try {
      let { granted } = await Notifications.getPermissionsAsync();
      if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) {
        setReminder({ state: 'denied' });
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Departure reminders',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to leave for ${originIata || 'the airport'} ✈ ${ident ?? 'your flight'}`,
          body: `Leave by ${formatTime(result.leaveBy.toISOString())} — ${result.driveMin} min drive, ~${result.wait.minutes} min security (estimate).`,
          sound: 'default',
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
      });
      setReminder({ state: 'set', at: fireAt.toISOString() });
    } catch {
      setReminder({ state: 'denied' });
    }
  };

  if (!flight || !result) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Departure Optimizer" />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="time"
            title="No upcoming flight"
            subtitle="Add a flight to your itinerary to get leave-by timing."
          />
        </View>
      </Screen>
    );
  }

  const overdue = result.minsUntil <= 0;
  const h = Math.floor(Math.abs(result.minsUntil) / 60);
  const m = Math.abs(result.minsUntil) % 60;
  const until = overdue
    ? `You're ${h > 0 ? `${h}h ` : ''}${m}m behind — go now`
    : `Leave in ${h > 0 ? `${h}h ` : ''}${m}m`;
  const urgency = urgencyOf(result.minsUntil);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={flight.item.title} title="Departure Optimizer" />

      {/* 1 — Next flight (live gate via useFlightStatus) */}
      <Card variant="glass" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="airplane" size={12} color={palette.bright} />
          <Text style={[type.overline, { color: palette.bright, flex: 1 }]}>Next flight</Text>
          {status.data ? (
            <Badge
              tone={statusTone(status.data.status)}
              label={statusLabel(status.data.status, status.data.delayMin)}
            />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>
            {ident ?? flight.item.title}
          </Text>
          <Text style={type.sub}>{formatTime(result.dep.toISOString())}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text style={[type.bodyDim, { flex: 1 }]} numberOfLines={1}>
            {originIata && destIata ? `${originIata} → ${destIata} · ` : ''}
            {formatDate(flight.item.startDate)}
          </Text>
          <Text style={[type.caption, { color: gate ? palette.bright : palette.dim }]}>
            {gate
              ? `${terminal ? `T${terminal} · ` : ''}Gate ${gate}`
              : 'Gate not assigned yet'}
          </Text>
        </View>
      </Card>

      {/* Inputs — drive time, lane, flight type */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="options" size={12} color={palette.bright} />
          <Text style={[type.overline, { color: palette.bright }]}>Adjust</Text>
        </View>
        <Input label="Drive to airport (min)" value={drive} onChangeText={setDrive} keyboardType="number-pad" />
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Security lane</Text>
          <Chips
            options={['standard', 'preCheck', 'clear'] as SecurityLane[]}
            value={lane}
            onChange={setLane}
            labelOf={(l) => LANE_LABEL[l]}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: '#8B92A8' }]}>Flight type</Text>
          <Chips
            options={['domestic', 'international'] as ('domestic' | 'international')[]}
            value={intl}
            onChange={setIntl}
          />
        </View>
      </Card>

      {/* 2 — LEAVE BY hero */}
      <Card variant="glass" style={{ marginTop: spacing.lg, alignItems: 'center', gap: spacing.xs }}>
        <Text style={[type.overline, { color: urgency.color }]}>{urgency.label}</Text>
        <Text style={[type.overline, { marginTop: spacing.sm }]}>Leave by</Text>
        <Text style={[type.display, { color: urgency.color }]}>
          {formatTime(result.leaveBy.toISOString())}
        </Text>
        <Text style={[type.sub, { color: overdue ? palette.bad : palette.good }]}>{until}</Text>
        <Text style={[type.bodyDim, { marginTop: 2 }]}>
          Flight departs {formatTime(result.dep.toISOString())} · {result.lead} min lead time
        </Text>
      </Card>

      {/* 3 — Live conditions: traffic · security · weather */}
      <View style={{ marginTop: spacing.lg }}>
        <LiveConditionsCard
          driveMin={result.driveMin}
          wait={result.wait}
          originIata={originIata || undefined}
          originCity={status.data?.origin.city ?? (originIata || undefined)}
        />
      </View>

      {/* 4 — The math: milestone times summing leave-by → departure */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.xs }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
        >
          <Ionicons name="list" size={12} color={palette.bright} />
          <Text style={[type.overline, { color: palette.bright }]}>The math</Text>
        </View>
        <MilestoneRow
          icon="car"
          title="Leave home"
          note={`${result.driveMin} min drive · typical traffic`}
          time={formatTime(result.leaveBy.toISOString())}
          color={urgency.color}
        />
        <MilestoneRow
          icon="shield-checkmark"
          title="Enter security"
          note={`~${result.wait.minutes} min wait (${result.wait.range[0]}–${result.wait.range[1]}) · estimate`}
          time={formatTime(result.enterSecurity.toISOString())}
        />
        <MilestoneRow
          icon="walk"
          title="Walk to gate"
          note={`${result.walkMin} min buffer`}
          time={formatTime(result.walkToGate.toISOString())}
        />
        <MilestoneRow
          icon="time"
          title="Arrive at gate by"
          note={`${result.boardMin} min before departure${intl === 'international' ? ' · international' : ''}`}
          time={formatTime(result.atGate.toISOString())}
        />
        <MilestoneRow
          icon="airplane"
          title="Scheduled departure"
          time={formatTime(result.dep.toISOString())}
          color={palette.bright}
          last
        />
      </Card>

      {/* 5 — Route preview map */}
      {originIata ? (
        <View style={{ marginTop: spacing.lg }}>
          <RouteMapPreview originIata={originIata} driveMin={result.driveMin} />
        </View>
      ) : null}

      {/* 6 — Rideshare (drop-off = origin airport) */}
      {originIata ? (
        <View style={{ marginTop: spacing.lg }}>
          <RideshareCard originIata={originIata} />
        </View>
      ) : null}

      {/* 7 — Remind me to leave */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="notifications" size={12} color={palette.bright} />
          <Text style={[type.overline, { color: palette.bright }]}>Automate</Text>
        </View>
        {reminder.state === 'set' || result.minsUntil > 10 ? (
          <>
            <Button
              title={reminder.state === 'set' ? 'Reminder set ✓' : 'Remind me to leave'}
              variant={reminder.state === 'set' ? 'secondary' : 'primary'}
              disabled={reminder.state === 'set'}
              icon={
                <Ionicons
                  name={reminder.state === 'set' ? 'checkmark-circle' : 'notifications'}
                  size={16}
                  color={reminder.state === 'set' ? palette.bright : '#04101F'}
                />
              }
              onPress={() => void remind()}
            />
            <Text style={type.caption}>
              {reminder.state === 'set' && reminder.at
                ? `Alert scheduled for ${formatTime(reminder.at)} — 10 min before leave-by.`
                : reminder.state === 'denied'
                  ? 'Enable notifications in Settings to get the leave-time alert.'
                  : 'Notifies you 10 minutes before your leave-by time.'}
            </Text>
          </>
        ) : (
          <Text style={type.caption}>Leave-by is too close for a reminder — time to head out.</Text>
        )}
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        All timings are estimates — typical traffic and a modeled security wait.
      </Text>
    </Screen>
  );
}
