import { Ionicons } from '@expo/vector-icons';
import React from 'react';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Ionicons visual for an Open-Meteo WMO weather code (≈ iOS systemIcon). */
export function weatherVisual(code: number): { icon: IoniconName; color: string } {
  if (code === 0 || code === 1) return { icon: 'sunny', color: '#F6C445' };
  if (code === 2) return { icon: 'partly-sunny', color: '#E8C468' };
  if (code === 3) return { icon: 'cloud', color: '#9BA7BF' };
  if (code === 45 || code === 48) return { icon: 'cloudy', color: '#9BA7BF' };
  if (code >= 71 && code <= 77) return { icon: 'snow', color: '#DDE7F5' };
  if (code >= 95) return { icon: 'thunderstorm', color: '#C9A5FF' };
  if (code >= 51) return { icon: 'rainy', color: '#5BBAFF' };
  return { icon: 'partly-sunny', color: '#E8C468' };
}
