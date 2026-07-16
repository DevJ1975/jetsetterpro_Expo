import * as Haptics from 'expo-haptics';

// Central haptics — one place so every interaction speaks the same tactile
// language. All calls are fire-and-forget and swallow errors (haptics throw on
// web / unsupported devices).

export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'soft'
  | 'rigid'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const IMPACT: Record<string, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: Haptics.ImpactFeedbackStyle.Soft,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
};
const NOTIFY: Record<string, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

function fire(kind: HapticKind): void {
  try {
    if (kind === 'selection') void Haptics.selectionAsync();
    else if (kind in NOTIFY) void Haptics.notificationAsync(NOTIFY[kind]);
    else void Haptics.impactAsync(IMPACT[kind] ?? Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op on unsupported platforms
  }
}

export const haptics = {
  /** A physical tap — button presses, taps. */
  impact: (kind: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light') => fire(kind),
  /** A tick — chip/segment/toggle/tab selection changes. */
  selection: () => fire('selection'),
  /** A completion — save committed, action succeeded/failed. */
  notify: (kind: 'success' | 'warning' | 'error' = 'success') => fire(kind),
  /** Fire by kind name (used by PressableScale's `haptic` prop). */
  fire,
};
