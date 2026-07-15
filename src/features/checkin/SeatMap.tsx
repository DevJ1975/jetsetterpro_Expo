import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing } from '@/src/ui';
import { EXIT_ROWS, SEAT_COLS, SEAT_ROWS } from './flightHash';

// Economy seat map — rows 8–32, 3-3 layout with the aisle between C and D,
// exit rows spaced (14, 21), taken seats hashed from the flight ident. Port of
// the iOS CheckInFlowView seat grid, adapted to a single selectable cabin.

const AISLE_W = 18;
const ROW_LABEL_W = 22;

function Seat({
  taken,
  selected,
  onPress,
  label,
}: {
  taken: boolean;
  selected: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      disabled={taken}
      onPress={onPress}
      accessibilityLabel={`Seat ${label}${taken ? ', taken' : selected ? ', selected' : ''}`}
      style={[styles.seat, taken && styles.seatTaken, selected && styles.seatSelected]}
    />
  );
}

export function SeatMap({
  taken,
  selected,
  onSelect,
}: {
  taken: Set<string>;
  selected: string | null;
  onSelect: (seat: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.swatch} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.seatTaken]} />
          <Text style={styles.legendText}>Taken</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.seatSelected]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>
      <Text style={styles.legendHint}>A · F window — C · D aisle</Text>

      {/* Column letters */}
      <View style={[styles.row, { marginTop: spacing.xs }]}>
        <View style={{ width: ROW_LABEL_W }} />
        {SEAT_COLS.map((c, i) => (
          <React.Fragment key={c}>
            {i === 3 ? <View style={{ width: AISLE_W }} /> : null}
            <Text style={styles.colLetter}>{c}</Text>
          </React.Fragment>
        ))}
        <View style={{ width: ROW_LABEL_W }} />
      </View>

      {/* Rows */}
      {SEAT_ROWS.map((row) => (
        <React.Fragment key={row}>
          {EXIT_ROWS.includes(row) ? (
            <View style={styles.exitRow}>
              <Text style={styles.exitText}>◂ EXIT</Text>
              <View style={styles.exitLine} />
              <Text style={styles.exitText}>EXIT ▸</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{row}</Text>
            {SEAT_COLS.map((col, i) => {
              const seat = `${row}${col}`;
              return (
                <React.Fragment key={seat}>
                  {i === 3 ? <View style={{ width: AISLE_W }} /> : null}
                  <Seat
                    label={seat}
                    taken={taken.has(seat)}
                    selected={selected === seat}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onSelect(seat);
                    }}
                  />
                </React.Fragment>
              );
            })}
            <Text style={[styles.rowLabel, { textAlign: 'left' }]}>{row}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: {
    width: ROW_LABEL_W,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
  },
  colLetter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
  },
  seat: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  seatTaken: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  seatSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.bright,
    shadowColor: palette.accent,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  exitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: 6,
  },
  exitText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: palette.warn },
  exitLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.15)' },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, color: palette.dim },
  legendHint: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.35)',
  },
});
