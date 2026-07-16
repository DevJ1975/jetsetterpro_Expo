// Solari-style departure board — port of iOS FlightBoardView. Near-black
// board chrome, yellow DEPARTURES header with a live 1s clock, pulsing SAMPLE
// badge (only while sample rows are visible), terminal filter capsules, and
// split-flap rows that re-derive statuses on a 30s tick (ON TIME → BOARDING →
// FINAL CALL → DEPARTED → retired). The user's own flights merge in
// chronologically, highlighted with an accent row treatment and live status
// via useFlightStatuses.

import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SplitFlapText, fonts, spacing } from '@/src/ui';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Screen } from '@/src/features/common/Screen';
import { isBackendConfigured } from '@/src/core/api/backend';
import { useFlightStatuses, type FlightStatusCode } from '@/src/core/api/flights';
import { useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';
import {
  BOARD_STATUS_COLORS,
  boardStatus,
  buildBoardRows,
  type BoardRow,
  type BoardStatusLabel,
} from '@/src/features/flight/boardData';
import { pad2 } from '@/src/features/flight/util';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const YELLOW = '#FFD60A';

// Split-flap cell metrics (spec: width ~11-12, height ~22, fontSize ~13).
const CW = 11;
const CH = 22;
const FS = 13;
// Column widths sized to the flap cells they hold (n·CW + (n−1)·1 gap).
const COL = { flight: 6 * CW + 5, to: 3 * CW + 2, time: 5 * CW + 4, gate: 3 * CW + 2 };

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Live date/time line (1s tick) — isolated so only this text re-renders. */
function BoardClock() {
  const clock = useNow(1000);
  const d = new Date(clock);
  const label = `${WEEKDAYS[d.getDay()]}  ${MONTHS[d.getMonth()]} ${d.getDate()}  ·  ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return (
    <Text
      style={{
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  );
}

/** Yellow pulsing dot for the SAMPLE badge (StatusDot is tone-locked). */
function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduce, progress]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1.4]) }],
  }));
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      {!reduce ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: color }, haloStyle]}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

/** Blinks its children — FINAL CALL rows flash like a real Solari board. */
function Blink({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!active || reduce) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, [active, reduce, opacity]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: opacity.value, flex: 1 }));
  return <Animated.View style={blinkStyle}>{children}</Animated.View>;
}

function ColumnTitle({ text, width }: { text: string; width?: number }) {
  return (
    <Text
      style={{
        fontFamily: fonts.rounded.extrabold,
        fontSize: 9,
        letterSpacing: 1.5,
        color: 'rgba(255,255,255,0.4)',
        width,
        flex: width == null ? 1 : undefined,
      }}
    >
      {text}
    </Text>
  );
}

function Cell({ text, width, tint }: { text: string; width?: number; tint: string }) {
  const flap = (
    <SplitFlapText
      text={text}
      characterWidth={CW}
      characterHeight={CH}
      fontSize={FS}
      tint={tint}
      background="#0F0F0F"
    />
  );
  if (width != null) return <View style={{ width, overflow: 'hidden' }}>{flap}</View>;
  return <View style={{ flex: 1, overflow: 'hidden' }}>{flap}</View>;
}

function BoardRowView({ row, status }: { row: BoardRow; status: BoardStatusLabel }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: row.isUser ? 'rgba(59,158,240,0.12)' : 'rgba(255,255,255,0.025)',
        borderWidth: row.isUser ? 1 : 0.5,
        borderColor: row.isUser ? 'rgba(59,158,240,0.45)' : 'rgba(255,255,255,0.05)',
      }}
    >
      <Cell text={row.flightNumber.padEnd(6).slice(0, 6)} width={COL.flight} tint={YELLOW} />
      <Cell text={row.dest.padEnd(3).slice(0, 3)} width={COL.to} tint={YELLOW} />
      <Cell text={row.timeLabel} width={COL.time} tint={YELLOW} />
      <Cell text={row.gate.padEnd(3).slice(0, 3)} width={COL.gate} tint={YELLOW} />
      <Blink active={status === 'FINAL CALL'}>
        <Cell text={status} tint={BOARD_STATUS_COLORS[status]} />
      </Blink>
    </View>
  );
}

export default function BoardScreen() {
  const trips = useTravel((s) => s.trips);
  const live = isBackendConfigured();
  const tick = useNow(30_000); // status re-derivation + retirement

  const [terminal, setTerminal] = useState('ALL');

  // Schedule anchor: interval state (hourly), so the sample times stay pinned
  // while the 30s tick only re-derives statuses — regenerating per tick would
  // reshuffle the schedule. The hourly rebuild also repopulates a board that
  // the retirement rule has slowly emptied.
  const anchor = useNow(3600_000);
  const rows = useMemo(() => buildBoardRows(trips, anchor), [trips, anchor]);

  // Live statuses for the user's own rows.
  const userQueries = rows
    .filter((r) => r.isUser && r.ident && r.date)
    .map((r) => ({ ident: r.ident as string, date: r.date as string }));
  const statusResults = useFlightStatuses(live ? userQueries : []);
  const liveByKey: Record<string, FlightStatusCode> = {};
  if (live) {
    userQueries.forEach((uq, i) => {
      const d = statusResults[i]?.data;
      if (d) liveByKey[`${uq.ident}|${uq.date}`] = d.status;
    });
  }

  // Re-derive + retire.
  const display = rows
    .map((row) => ({
      row,
      status: boardStatus(row, tick, row.ident && row.date ? liveByKey[`${row.ident}|${row.date}`] : undefined),
    }))
    .filter((x): x is { row: BoardRow; status: BoardStatusLabel } => x.status !== null);

  const terminals = [
    'ALL',
    ...Array.from(new Set(display.map((d) => d.row.terminal).filter(Boolean))).sort(),
  ];
  // If the selected terminal's last flight retired, fall back to ALL.
  const effTerminal = terminals.includes(terminal) ? terminal : 'ALL';
  const filtered =
    effTerminal === 'ALL' ? display : display.filter((d) => d.row.terminal === effTerminal);
  const sampleShown = filtered.some((d) => !d.row.isUser);

  return (
    <Screen scroll={false}>
      {/* Board chrome: near-black over the hero gradient. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050505' }]} pointerEvents="none" />

      <BackHeader title="Departures" />

      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        {/* ── Yellow header + live clock + SAMPLE badge ─────────────────── */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.rounded.extrabold,
                fontSize: 11,
                letterSpacing: 2.5,
                color: 'rgba(255,214,10,0.85)',
              }}
            >
              DEPARTURES
            </Text>
            <BoardClock />
          </View>
          {sampleShown ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              accessibilityLabel="Sample departure board. Illustrative flights only."
            >
              <PulseDot color={YELLOW} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                SAMPLE
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Terminal filter capsules ──────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: spacing.md }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          {terminals.map((t) => {
            const selected = t === effTerminal;
            return (
              <Pressable
                key={t}
                onPress={() => setTerminal(t)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 0.5,
                  backgroundColor: selected ? 'rgba(255,214,10,0.18)' : 'rgba(255,255,255,0.06)',
                  borderColor: selected ? 'rgba(255,214,10,0.6)' : 'rgba(255,255,255,0.12)',
                }}
              >
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.5,
                    color: selected ? YELLOW : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {t === 'ALL' ? 'ALL' : `T${t}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Column header ─────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 6,
            paddingVertical: 4,
          }}
        >
          <ColumnTitle text="FLIGHT" width={COL.flight} />
          <ColumnTitle text="TO" width={COL.to} />
          <ColumnTitle text="TIME" width={COL.time} />
          <ColumnTitle text="GATE" width={COL.gate} />
          <ColumnTitle text="STATUS" />
        </View>

        {/* ── Rows ──────────────────────────────────────────────────────── */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 32 }}>
          {filtered.map(({ row, status }) => (
            <BoardRowView key={row.key} row={row} status={status} />
          ))}
          {filtered.length === 0 ? (
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: 'rgba(255,255,255,0.4)',
                textAlign: 'center',
                paddingVertical: 32,
                letterSpacing: 1,
              }}
            >
              NO DEPARTURES
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}
