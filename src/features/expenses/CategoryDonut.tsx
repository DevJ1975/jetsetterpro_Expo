import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '@/src/ui';

// Donut chart — the RN/SVG port of the iOS Swift Charts SectorMark donut in
// CurrencyExpenseView ("Spend by Category"): stroked-circle segments via
// strokeDasharray with a small angular inset between slices and center content
// (the total) rendered as children.

export interface DonutSegment {
  color: string;
  value: number;
}

export function CategoryDonut({
  segments,
  size = 180,
  strokeWidth = 8,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  /** Center content (e.g. the total). */
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  // iOS SectorMark(angularInset: 2) — a slim gap between slices, skipped for a
  // single slice (a full ring needs no seams).
  const gap = positive.length > 1 ? 3 : 0;

  let start = 0;
  const arcs = positive.map((s, i) => {
    const length = (s.value / total) * circumference;
    const dash = Math.max(0, length - gap);
    const arc = (
      <Circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={s.color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${dash} ${Math.max(0.001, circumference - dash)}`}
        strokeDashoffset={-(start + gap / 2)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    );
    start += length;
    return arc;
  });

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        {total <= 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.elevated2}
            strokeWidth={strokeWidth}
            fill="none"
          />
        ) : (
          arcs
        )}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
