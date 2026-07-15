import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { palette } from '@/src/ui';
import { formatMoney } from '@/src/core/format';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import type { ExpenseCategory } from '@/src/types/models';
import { EXPENSE_CATEGORY_META } from './categoryMeta';

// Horizontal category bar chart — the RN/SVG port of the iOS Swift Charts
// BarMark block in ExpenseTrackerView ("Spending by Category"): one rounded
// colored bar per category with the category name as the y-axis label and a
// trailing amount annotation. Bars grow in on mount so it shares the motion
// language of the donut + progress ring (snaps under Reduce Motion).

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const ROW_H = 38; // iOS: frame(height: count * 40)
const BAR_H = 20;
const BAR_RX = 5; // iOS .cornerRadius(5)
const LABEL_W = 96; // y-axis label gutter
const GUTTER = 8; // gap between axis labels and plot
const ANNOT_W = 72; // room reserved for the trailing amount annotation

export interface CategoryAmount {
  category: ExpenseCategory;
  amount: number;
}

function GrowBar({
  x,
  y,
  barW,
  fill,
  grow,
}: {
  x: number;
  y: number;
  barW: number;
  fill: string;
  grow: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({ width: Math.max(0.001, barW * grow.value) }));
  return (
    <AnimatedRect
      x={x}
      y={y}
      width={0}
      height={BAR_H}
      rx={BAR_RX}
      fill={fill}
      animatedProps={animatedProps}
    />
  );
}

export function CategoryBarChart({
  data,
  currency,
}: {
  /** Pre-sorted (descending) category totals in a single currency. */
  data: CategoryAmount[];
  /** ISO code shown in the bar annotations. */
  currency: string;
}) {
  const [width, setWidth] = useState(0);
  const reduce = useReduceMotion();
  const grow = useSharedValue(0);
  const height = Math.max(80, data.length * ROW_H);
  const max = data.reduce((m, d) => Math.max(m, d.amount), 0);
  const plotW = Math.max(0, width - LABEL_W - GUTTER - ANNOT_W);

  useEffect(() => {
    if (width === 0) return;
    grow.value = 0;
    grow.value = reduce ? 1 : withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [width, reduce, grow, data.length]);

  return (
    <View
      style={{ width: '100%', height }}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 && max > 0 ? (
        <Svg width={width} height={height}>
          {data.map((d, i) => {
            const meta = EXPENSE_CATEGORY_META[d.category];
            const barW = Math.max(3, (d.amount / max) * plotW);
            const rowTop = i * ROW_H;
            const barY = rowTop + (ROW_H - BAR_H) / 2;
            const midBaseline = rowTop + ROW_H / 2 + 4; // optical vertical centering
            return (
              <React.Fragment key={d.category}>
                <SvgText
                  x={LABEL_W}
                  y={midBaseline}
                  fontSize={11}
                  fill={palette.dim}
                  textAnchor="end"
                >
                  {meta.label}
                </SvgText>
                <GrowBar x={LABEL_W + GUTTER} y={barY} barW={barW} fill={meta.color} grow={grow} />
                <SvgText
                  x={LABEL_W + GUTTER + barW + 6}
                  y={midBaseline}
                  fontSize={10}
                  fill={palette.dim}
                  textAnchor="start"
                >
                  {formatMoney(Math.round(d.amount), currency)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
