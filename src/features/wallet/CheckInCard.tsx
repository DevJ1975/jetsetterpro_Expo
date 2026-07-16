import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate, formatTime } from '@/src/core/format';
import { useCheckIn } from '@/src/core/store/checkin';
import { useNow } from '@/src/core/useNow';
import { airlineDisplayName, checkInLeadHours } from '@/src/features/checkin/airlineLinks';

// Online check-in card — port of iOS `CheckInCardView`: airline row with the
// live "opens/closes in Xh Ym" countdown (1-min tick) and the Check In Now
// button that launches the seat-map flow. Hidden once the flight departs or
// while it's still far outside the check-in window.

/** Show the card starting this many ms before the check-in window opens. */
const VISIBLE_LEAD_MS = 36 * 3_600_000;
/** Online check-in typically closes 45 min before departure. */
const CLOSE_BEFORE_MS = 45 * 60_000;

function hm(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function CheckInCard({ ident, dateISO }: { ident: string; dateISO: string }) {
  const router = useRouter();
  const now = useNow(60_000); // 1-min tick keeps the countdown live
  const identU = ident.toUpperCase();
  const checkedInAt = useCheckIn((s) => s.checkedIn[identU]);
  const seat = useCheckIn((s) => s.seats[identU]);

  const dep = Date.parse(dateISO.length === 10 ? `${dateISO}T00:00:00` : dateISO);
  if (!Number.isFinite(dep)) return null;

  // Checked in → quiet confirmation row instead of the countdown card.
  if (checkedInAt) {
    return (
      <Card variant="glass" style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="checkmark-circle" size={22} color={palette.good} />
          <Text style={[type.body, { flex: 1 }]}>
            Checked in{seat ? ` · Seat ${seat}` : ''}
          </Text>
        </View>
      </Card>
    );
  }

  const opensAt = dep - checkInLeadHours(identU) * 3_600_000;
  const closesAt = dep - CLOSE_BEFORE_MS;
  if (now >= dep) return null; // departed
  if (dep - now > VISIBLE_LEAD_MS) return null; // still far outside the window

  const open = now >= opensAt && now < closesAt;
  const countdown =
    now < opensAt
      ? `Check-in opens in ${hm(opensAt - now)}`
      : now < closesAt
        ? `Check-in closes in ${hm(closesAt - now)}`
        : 'Online check-in closed — see an agent';

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[type.overline, { color: palette.bright, marginBottom: spacing.sm }]}>
        Online check-in
      </Text>
      <Card variant="glass" style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconWell name="airplane" />
          <View style={{ flex: 1 }}>
            <Text style={type.sub} numberOfLines={1}>
              {airlineDisplayName(identU)}
            </Text>
            <Text style={type.caption}>
              {identU} · {formatDate(dateISO)}
              {dateISO.length > 10 ? ` · ${formatTime(dateISO)}` : ''}
            </Text>
          </View>
        </View>
        <Text style={[type.caption, { color: open ? palette.good : palette.dim }]}>
          {countdown}
        </Text>
        <Button
          title={open ? 'Check In Now' : 'Check In (Not Yet Open)'}
          disabled={!open}
          onPress={() =>
            router.push({ pathname: '/checkin', params: { ident: identU, date: dateISO } })
          }
        />
      </Card>
    </View>
  );
}
