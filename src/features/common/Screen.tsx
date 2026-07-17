import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import React, { useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { gradients, palette } from '@/src/ui';

/** App screen scaffold: hero-gradient background + safe area, per the design kit
 *  ("Base is palette.ink or the gradients.hero wash").
 *
 *  On iOS the tab bar floats over a blur (parity with the native app's
 *  .ultraThinMaterial TabView), so tab screens read the bar height from
 *  context and pad their content to scroll clear of it. Outside the tab
 *  navigator the context is undefined and no extra inset applies. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top'],
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  /** Enables pull-to-refresh on scrollable screens. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const floatingInset = Platform.OS === 'ios' ? tabBarHeight : 0;

  const body = scroll ? (
    // Keyboard avoidance is layout-driven (KAV padding) rather than
    // `automaticallyAdjustKeyboardInsets`: on the New Architecture that prop
    // mutates contentInset/contentOffset natively on keyboard-show and only
    // restores them on a clean keyboard-hide notification — dismissals via a
    // Modal, an app hand-off (Uber/Lyft deep link), or a missed iOS frame left
    // screens permanently scrolled off-screen (facebook/react-native#47731).
    // A padding KAV simply re-lays-out when the keyboard goes away, so content
    // can never get stranded. (Android resizes the window via adjustResize.)
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[{ paddingBottom: 56 + floatingInset }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.bright}
              colors={[palette.accent]}
              progressBackgroundColor={palette.elevated}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    // Non-scroll screens that host text inputs still need the keyboard to push
    // content up rather than cover it.
    <KeyboardAvoidingView
      style={[{ flex: 1, paddingBottom: floatingInset }, contentStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {body}
      </SafeAreaView>
    </LinearGradient>
  );
}
