import React from 'react';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { gradients } from '@/src/ui';

/**
 * Brand gold-gradient text, rendered as SVG text with a LinearGradient fill —
 * same technique as the Splash wordmark (RN can't gradient-fill a <Text>).
 * Uses the kit's `gradients.goldText` stops (iOS goldGradient). Shared by the
 * onboarding logo pill, the paywall kicker, and the About wordmark.
 */
export function GoldGradientText({
  text,
  fontSize,
  fontFamily,
  letterSpacing = 0,
  width,
  height,
}: {
  text: string;
  fontSize: number;
  fontFamily: string;
  letterSpacing?: number;
  width: number;
  height?: number;
}) {
  const h = height ?? Math.ceil(fontSize * 1.32);
  return (
    <Svg width={width} height={h}>
      <Defs>
        <SvgLinearGradient id="goldText" x1="0" y1="0" x2="1" y2="1">
          {gradients.goldText.map((color, i) => (
            <Stop
              key={color}
              offset={i / (gradients.goldText.length - 1)}
              stopColor={color}
            />
          ))}
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={width / 2}
        y={fontSize}
        fontSize={fontSize}
        fontFamily={fontFamily}
        letterSpacing={letterSpacing}
        fill="url(#goldText)"
        textAnchor="middle"
      >
        {text}
      </SvgText>
    </Svg>
  );
}
