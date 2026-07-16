import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette, radii, spacing, type } from '@/src/ui';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { useIris } from '@/src/core/store/iris';
import { PendingKind, useIrisRouter } from '@/src/core/store/irisRouter';

// IRIS's full-spectrum identity — the 6-stop rainbow from the native app
// (IRISSuggestionCardView.swift rainbowGradient).
export const IRIS_SPECTRUM = [
  '#E84040',
  '#E8A020',
  '#FFEB00',
  '#1DB97D',
  '#3B9EF0',
  '#7B3FBF',
] as const;

export function IrisOrb({ size = 22 }: { size?: number }) {
  return (
    <LinearGradient
      colors={IRIS_SPECTRUM}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.4)',
      }}
    />
  );
}

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

export function MessageBubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  if (role === 'user') {
    return (
      <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
        <View style={{ flex: 1, minWidth: 40 }} />
        <View
          style={{
            maxWidth: '82%',
            backgroundColor: 'rgba(59,158,240,0.85)',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={[type.body, { color: '#FFFFFF' }]} selectable>
            {text}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: spacing.md, maxWidth: '92%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <IrisOrb size={18} />
        <Text style={[type.overline, { color: palette.bright }]}>IRIS</Text>
      </View>
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 0.5,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={[type.body, { color: palette.text }]} selectable>
          {cleanMarkdown(text)}
        </Text>
      </View>
    </View>
  );
}

export function ThinkingDots() {
  const reduce = useReduceMotion();
  // One shared value per dot; staggered opacity pulse (snaps to static under RM).
  const d0 = useSharedValue(0.4);
  const d1 = useSharedValue(0.4);
  const d2 = useSharedValue(0.4);

  useEffect(() => {
    const vals = [d0, d1, d2];
    if (reduce) {
      vals.forEach((d) => {
        d.value = 0.7;
      });
      return;
    }
    vals.forEach((d, i) => {
      d.value = 0.4;
      // Phase offset OUTSIDE the repeat so all three dots share one 800ms
      // period — a delay INSIDE withRepeat makes each period i*160+800 and they
      // drift out of sync after the first cycle.
      d.value = withDelay(
        i * 160,
        withRepeat(
          withSequence(withTiming(1, { duration: 400 }), withTiming(0.4, { duration: 400 })),
          -1,
          false,
        ),
      );
    });
  }, [reduce, d0, d1, d2]);

  const s0 = useAnimatedStyle(() => ({ opacity: d0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const dotStyles = [s0, s1, s2];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.md }}>
      <IrisOrb size={18} />
      {dotStyles.map((st, i) => (
        <Animated.View
          key={i}
          style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.bright }, st]}
        />
      ))}
    </View>
  );
}

const KIND_META: Record<PendingKind, { icon: string; label: string }> = {
  logExpense: { icon: 'cash', label: 'Log it' },
  checkIn: { icon: 'checkmark-circle', label: 'Check in' },
  addTrip: { icon: 'briefcase', label: 'Add trip' },
  trackFlight: { icon: 'airplane', label: 'Track' },
  generatePackingList: { icon: 'list', label: 'Generate' },
  submitExpenses: { icon: 'paper-plane', label: 'Submit' },
  addToCalendar: { icon: 'calendar', label: 'Add to Calendar' },
  bookFlight: { icon: 'airplane', label: 'Book flight' },
  cancelBooking: { icon: 'close-circle', label: 'Cancel booking' },
};

export function ConfirmationCard() {
  const pending = useIrisRouter((s) => s.pendingAction);
  const confirmPending = useIris((s) => s.confirmPending);
  const cancelPending = useIris((s) => s.cancelPending);
  const isResponding = useIris((s) => s.isResponding);
  const [committing, setCommitting] = useState(false);

  if (!pending) return null;
  const meta = KIND_META[pending.kind];
  // Block confirm/cancel until the streaming turn finishes (it owns apiMessages).
  const busy = committing || isResponding;

  const onConfirm = async () => {
    if (busy) return;
    setCommitting(true);
    await confirmPending();
    setCommitting(false);
  };

  return (
    <View
      style={{
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        backgroundColor: palette.surfaceGlass,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59,158,240,0.35)',
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={meta.icon as never} size={18} color={palette.accent} />
        <Text style={[type.overline, { color: palette.bright }]}>Confirm</Text>
      </View>
      <Text style={type.sub}>{pending.summary}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Pressable
          onPress={cancelPending}
          disabled={busy}
          style={{
            flex: 1,
            height: 44,
            borderRadius: radii.control,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={[type.body, { color: palette.text, fontWeight: '700' }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          style={{
            flex: 1,
            height: 44,
            borderRadius: radii.control,
            backgroundColor: palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {committing ? (
            <ActivityIndicator color="#04101F" />
          ) : (
            <Text style={[type.body, { color: '#04101F', fontWeight: '700' }]}>{meta.label}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
