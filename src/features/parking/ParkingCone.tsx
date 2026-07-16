import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * Classic orange traffic cone — a crisp vector graphic (no image asset) for the
 * Parking feature's hero + saved-spot card. Reflective white bands follow the
 * cone's taper. Purely decorative; callers provide the accessible label.
 */
export function ParkingCone({ size = 96 }: { size?: number }) {
  const w = size;
  const h = (size * 72) / 64;
  return (
    <Svg width={w} height={h} viewBox="0 0 64 72" accessibilityElementsHidden importantForAccessibility="no">
      {/* base slab */}
      <Rect x="6" y="57" width="52" height="9" rx="4.5" fill="#C25E17" />
      <Rect x="10" y="54" width="44" height="6" rx="3" fill="#E8731F" />
      {/* cone body */}
      <Path
        d="M32 6 L 50 55 L 14 55 Z"
        fill="#F5822A"
        stroke="#D96A1B"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* reflective bands (trapezoids matching the taper) */}
      <Path d="M25 25 L 39 25 L 42 33 L 22 33 Z" fill="#FFF3E6" />
      <Path d="M19.5 40 L 44.5 40 L 47.5 48 L 16.5 48 Z" fill="#FFF3E6" />
      {/* left-edge highlight */}
      <Path d="M32 6 L 30 12 L 20 48 L 16.5 48 Z" fill="#FF9E4D" opacity={0.35} />
    </Svg>
  );
}
