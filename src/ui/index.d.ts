// Type declarations for the JetSetter design-system kit (authored in JS).
// Runtime comes from index.js; these types give screens full IntelliSense.
import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type PaletteKey =
  | 'accent'
  | 'bright'
  | 'deep'
  | 'blueMuted'
  | 'primaryDeep'
  | 'ink'
  | 'bgMid'
  | 'bgDeep'
  | 'background'
  | 'surface'
  | 'surfaceGlass'
  | 'elevated'
  | 'elevated2'
  | 'text'
  | 'dim'
  | 'faint'
  | 'good'
  | 'warn'
  | 'bad'
  | 'line'
  | 'lineStrong'
  | 'separator'
  | 'fillAccent'
  | 'fillGood'
  | 'fillWarn'
  | 'fillBad'
  | 'champagne'
  | 'gold'
  | 'deepGold';

export const palette: Record<PaletteKey, string>;
// Tuple type (min 2 stops) so it satisfies expo-linear-gradient's `colors` prop.
export type GradientStops = readonly [string, string, ...string[]];
export const gradients: Record<
  'hero' | 'brand' | 'progress' | 'goldText' | 'cardBorder' | 'cardInnerGlow',
  GradientStops
> & { brandLocations: readonly [number, number, ...number[]] };

export const fonts: {
  rounded: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold', string>;
  mono: string;
};
export const fontAssets: Record<string, number>;

export type TypeKey =
  | 'display'
  | 'title'
  | 'heading'
  | 'sub'
  | 'body'
  | 'bodyDim'
  | 'caption'
  | 'overline'
  | 'stat';
export const type: Record<TypeKey, TextStyle>;

export const spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl', number>;
export const hitSlop: { top: number; bottom: number; left: number; right: number };
export const radii: Record<'control' | 'card' | 'sheet' | 'pill', number>;
export const shadows: Record<'card' | 'float' | 'glowAccent', ViewStyle>;

export type Tone = 'accent' | 'good' | 'warn' | 'bad' | 'neutral';

export const Button: ComponentType<{
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export const Card: ComponentType<{
  children?: ReactNode;
  variant?: 'solid' | 'glass' | 'outline';
  style?: StyleProp<ViewStyle>;
}>;

export const Badge: ComponentType<{ label: string; tone?: Tone; style?: StyleProp<ViewStyle> }>;

export const StatusDot: ComponentType<{
  tone?: 'good' | 'warn' | 'bad' | 'accent';
  size?: number;
  pulse?: boolean;
}>;

export const ListRow: ComponentType<{
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}>;

export const ScreenHeader: ComponentType<{
  overline?: string;
  title: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export const Input: ComponentType<
  {
    label?: string;
    style?: StyleProp<ViewStyle>;
  } & Record<string, unknown>
>;

export const ProgressBar: ComponentType<{
  value?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}>;

export const SectionLabel: ComponentType<{ children: ReactNode; style?: StyleProp<ViewStyle> }>;

export type HapticKind =
  | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
  | 'selection' | 'success' | 'warning' | 'error';
export const PressableScale: ComponentType<
  {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    scaleTo?: number;
    dimTo?: number;
    haptic?: HapticKind;
  } & Record<string, unknown>
>;

export const Skeleton: ComponentType<{
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

// ── Signature components (iOS UI/Components ports) ─────────────────────────

export const SplitFlapText: ComponentType<{
  text: string;
  characterWidth?: number;
  characterHeight?: number;
  fontSize?: number;
  tint?: string;
  background?: string;
  staggerDelay?: number;
  stepDuration?: number;
}>;

export type CounterFormat = 'integer' | { decimal: number } | { currency: string };
export const AnimatedCounter: ComponentType<{
  target: number;
  duration?: number;
  format?: CounterFormat;
  style?: StyleProp<TextStyle>;
}>;
export function formatCounterValue(value: number, format: CounterFormat): string;

export const CardAppear: ComponentType<{
  children?: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export const ProgressRing: ComponentType<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export const StarField: ComponentType<{ count?: number; seed?: number }>;

export const SuccessAnimation: ComponentType<{
  title: string;
  subtitle: string;
  referenceNumber?: string | null;
  onDismiss: () => void;
}>;

export const Splash: ComponentType<{ onDone: () => void }>;

export const FLAP_ALPHABET: readonly string[];
export function normalizeFlapChar(char: string): string;
export function nextFlapChar(current: string): string;
export function flapDistance(current: string, target: string): number;
