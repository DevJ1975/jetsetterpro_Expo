import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { palette } from '@/src/ui';

const TAB_ICON: Record<string, string> = {
  index: 'home',
  itinerary: 'calendar',
  iris: 'sparkles',
  expenses: 'stats-chart',
  more: 'ellipsis-horizontal-circle',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.bright,
        tabBarInactiveTintColor: palette.faint,
        tabBarStyle: {
          backgroundColor: 'rgba(10,13,22,0.96)',
          borderTopColor: palette.line,
          borderTopWidth: 1,
        },
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
