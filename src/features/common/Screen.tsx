import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { gradients } from '@/src/ui';

/** App screen scaffold: hero-gradient background + safe area, per the design kit
 *  ("Base is palette.ink or the gradients.hero wash"). */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingBottom: 56 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
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
