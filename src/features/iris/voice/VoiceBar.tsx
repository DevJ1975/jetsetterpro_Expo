import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette, radii, spacing, type } from '@/src/ui';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { IrisOrb } from '@/src/features/iris/components';
import type { IrisVoice, VoiceState } from './useIrisVoice';

const LABEL: Record<Exclude<VoiceState, 'idle'>, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking… tap to interrupt',
};

/** Mic toggle for the composer row. Filled/red while a voice session is live. */
export function MicButton({
  active,
  disabled = false,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{ paddingBottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Stop voice input' : 'Start voice input'}
      accessibilityHint={active ? 'Ends the hands-free voice session' : 'Talk to IRIS hands-free'}
      accessibilityState={{ disabled }}
    >
      <Ionicons
        name={active ? 'stop-circle' : 'mic-outline'}
        size={32}
        color={active ? '#F0616E' : disabled ? 'rgba(255,255,255,0.25)' : palette.bright}
      />
    </Pressable>
  );
}

/**
 * Hands-free voice overlay. Shows the live transcript and loop phase; tapping it
 * while IRIS is speaking barges in (jumps straight back to listening).
 */
export function VoiceBar({ voice }: { voice: IrisVoice }) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const active = voice.state === 'listening' || voice.state === 'speaking';

  useEffect(() => {
    if (!active || reduce) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(withTiming(1.35, { duration: 650 }), withTiming(1, { duration: 650 })),
      -1,
      false,
    );
  }, [active, reduce, scale]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (voice.state === 'idle') return null;

  const onPress = () => {
    if (voice.state === 'speaking') voice.interruptSpeaking();
  };

  return (
    <Pressable
      onPress={onPress}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Animated.View style={orbStyle}>
          <IrisOrb size={16} />
        </Animated.View>
        <Text style={[type.overline, { color: palette.bright, flex: 1 }]}>
          {LABEL[voice.state]}
        </Text>
        <Pressable
          onPress={voice.stop}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            height: 30,
            borderRadius: radii.pill,
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Ionicons name="stop" size={12} color={palette.text} />
          <Text style={[type.caption, { color: palette.text, fontWeight: '700' }]}>Stop</Text>
        </Pressable>
      </View>

      {voice.transcript ? (
        <Text style={[type.body, { color: palette.text }]}>{voice.transcript}</Text>
      ) : voice.state === 'listening' ? (
        <Text style={type.bodyDim}>Say something — I’m listening.</Text>
      ) : null}
    </Pressable>
  );
}
