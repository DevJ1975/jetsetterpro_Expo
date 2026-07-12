// Type declarations for the JetSetter design-system kit (authored in JS).
// Runtime comes from index.js; these types give screens full IntelliSense.
import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type PaletteKey =
  | 'accent'
  | 'bright'
  | 'deep'
  | 'ink'
  | 'bgMid'
  | 'bgDeep'
  | 'surface'
  | 'surfaceGlass'
  | 'elevated'
  | 'text'
  | 'dim'
  | 'faint'
  | 'good'
  | 'warn'
  | 'bad'
  | 'line'
  | 'lineStrong'
  | 'fillAccent'
  | 'fillGood'
  | 'fillWarn'
  | 'fillBad'
  | 'champagne'
  | 'gold'
  | 'deepGold';

export const palette: Record<PaletteKey, string>;
// Tuple type (min 2 stops) so it satisfies expo-linear-gradient's `colors` prop.
export const gradients: Record<
  'hero' | 'brand' | 'progress' | 'goldText',
  readonly [string, string, ...string[]]
>;

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

export const TabBar: ComponentType<{
  tabs: { key: string; label: string; icon?: (active: boolean) => ReactNode }[];
  activeKey: string;
  onChange: (key: string) => void;
}>;

export const SectionLabel: ComponentType<{ children: ReactNode; style?: StyleProp<ViewStyle> }>;
