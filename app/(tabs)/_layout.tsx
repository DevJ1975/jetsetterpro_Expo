import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { palette } from '@/src/ui';

const TAB_ICON: Record<string, string> = {
  index: 'home',
  itinerary: 'calendar',
  iris: 'sparkles',
  expenses: 'stats-chart',
  more: 'ellipsis-horizontal-circle',
};

// iOS parity: the native app's TabView bar is .ultraThinMaterial with a
// hairline accent separator — content scrolls beneath it. On iOS we float the
// bar over a BlurView; Android keeps an opaque bar (no cheap material there).
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.dim,
        tabBarStyle: {
          borderTopColor: 'rgba(59,158,240,0.20)',
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'ios'
            ? { position: 'absolute' as const, backgroundColor: 'transparent' }
            : { backgroundColor: 'rgba(10,13,22,0.96)' }),
        },
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  tint="dark"
                  intensity={40}
                  style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,13,22,0.35)' }]}
                />
              )
            : undefined,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={(TAB_ICON[route.name] ?? 'ellipse') as never} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="itinerary" options={{ title: 'Itinerary' }} />
      <Tabs.Screen name="iris" options={{ title: 'IRIS' }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
