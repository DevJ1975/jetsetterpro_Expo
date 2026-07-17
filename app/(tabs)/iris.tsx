import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import React, { useCallback, useContext, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, gradients, palette, radii, spacing, type } from '@/src/ui';
import {
  ConfirmationCard,
  MessageBubble,
  ThinkingDots,
} from '@/src/features/iris/components';
import { LearningPrompt } from '@/src/features/iris/LearningPrompt';
import { MicButton, VoiceBar } from '@/src/features/iris/voice/VoiceBar';
import { useIrisVoice } from '@/src/features/iris/voice/useIrisVoice';
import { composeGreeting } from '@/src/core/ai/iris/agent';
import { useIris } from '@/src/core/store/iris';
import { useIrisMemory } from '@/src/core/store/irisMemory';
import { TAP_ONLY_KINDS, useIrisRouter } from '@/src/core/store/irisRouter';

// Spoken yes/no so hands-free voice can confirm a staged action without a tap.
const AFFIRM = /^(yes|yeah|yep|yup|sure|ok(ay)?|confirm(ed)?|do it|go ahead|please do|correct|sounds good)\b/i;
const DENY = /^(no|nope|nah|cancel|don'?t|do not|never ?mind|forget it|skip it)\b/i;

export default function IrisScreen() {
  const router = useRouter();
  const messages = useIris((s) => s.messages);
  const streamingContent = useIris((s) => s.streamingContent);
  const isResponding = useIris((s) => s.isResponding);
  const send = useIris((s) => s.send);
  const clear = useIris((s) => s.clear);
  const confirmPending = useIris((s) => s.confirmPending);
  const cancelPending = useIris((s) => s.cancelPending);
  const queuedPrompt = useIris((s) => s.queuedPrompt);
  const consumeQueuedPrompt = useIris((s) => s.consumeQueuedPrompt);
  const knownPrefs = useIrisMemory((s) => s.preferences.length);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Consume a prompt handed over from a Home suggestion card.
  useFocusEffect(
    useCallback(() => {
      if (queuedPrompt) {
        const p = queuedPrompt;
        consumeQueuedPrompt();
        void send(p);
      }
    }, [queuedPrompt, consumeQueuedPrompt, send]),
  );

  // Voice loop bridge: a spoken utterance runs the same send path as typing,
  // then IRIS's final reply is read back aloud. If IRIS has staged a
  // confirm-before-commit action, a spoken "yes"/"no" resolves it hands-free
  // instead of dead-ending on the (tap-only) confirmation card.
  const onUtterance = useCallback(
    async (text: string): Promise<string | null> => {
      const lastAssistant = (): string | null => {
        const msgs = useIris.getState().messages;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') return msgs[i].text;
        }
        return null;
      };
      const trimmed = text.trim();
      const pending = useIrisRouter.getState().pendingAction;
      if (pending) {
        if (AFFIRM.test(trimmed)) {
          // Money-moving actions (booking/cancelling a flight) are committed
          // ONLY by an explicit on-screen tap — a spoken "yes" is too easy to
          // trigger accidentally for a purchase.
          if (TAP_ONLY_KINDS.has(pending.kind)) {
            return 'This one needs a tap — please confirm on the card so I know it’s really you.';
          }
          await confirmPending();
          return lastAssistant();
        }
        if (DENY.test(trimmed)) {
          cancelPending();
          return lastAssistant();
        }
      }
      await send(text);
      return lastAssistant();
    },
    [send, confirmPending, cancelPending],
  );
  const voice = useIrisVoice(onUtterance);
  const voiceActive = voice.state !== 'idle';

  // Stop the voice loop when leaving the tab so the mic never lingers. Depend on
  // the stable `voice.stop` (not the whole `voice` object, which is a new
  // reference every render — that would tear the loop down on each state change).
  const stopVoice = voice.stop;
  useFocusEffect(
    useCallback(() => {
      return () => stopVoice();
    }, [stopVoice]),
  );

  // iOS floats the tab bar over a blur; keep the composer above it.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const floatingInset = Platform.OS === 'ios' ? tabBarHeight : 0;

  const canSend = draft.trim().length > 0 && !isResponding && !voiceActive;
  // Don't let voice start mid-way through a typed turn — its reply read-back
  // would race the streaming response.
  const micDisabled = isResponding && !voiceActive;
  const dispatch = () => {
    if (!canSend) return;
    const text = draft;
    setDraft('');
    void send(text);
  };

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          overline="Intelligent Routing & Itinerary Specialist"
          title="IRIS"
          right={
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <Pressable
                onPress={clear}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="New chat"
                accessibilityHint="Clears this conversation and starts a new one"
              >
                <Ionicons name="create-outline" size={24} color={palette.bright} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/iris/memory')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Saved memories"
                accessibilityHint="Review what IRIS remembers about you"
              >
                <Ionicons name="bookmark-outline" size={24} color={palette.bright} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/iris/profile')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Learned profile"
                accessibilityHint="Review the preferences IRIS has learned"
              >
                <Ionicons name="sparkles-outline" size={24} color={palette.bright} />
              </Pressable>
            </View>
          }
        />

        {/* The tab-bar inset must NOT live on the KAV itself: behavior="padding"
            composes {paddingBottom: keyboardHeight} over this style, forcing it
            to 0 whenever the keyboard is closed — which left the composer under
            the floating tab bar, swallowing every tap (keyboard could never
            open). The composer row carries the inset instead, and the KAV's
            offset compensates so the gap above the keyboard stays exact. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8 - floatingInset}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            <LearningPrompt />

            {messages.length === 0 && !isResponding ? (
              <Text style={[type.bodyDim, { marginTop: spacing.md }]}>{composeGreeting(knownPrefs)}</Text>
            ) : null}

            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} />
            ))}

            {isResponding && streamingContent ? (
              <MessageBubble role="assistant" text={streamingContent} />
            ) : isResponding ? (
              <ThinkingDots />
            ) : null}
          </ScrollView>

          <ConfirmationCard />
          <VoiceBar voice={voice} />

          {voice.status ? (
            <Text style={[type.caption, { color: palette.faint, paddingHorizontal: spacing.xl, marginBottom: spacing.xs }]}>
              {voice.status}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.sm,
              // Clears the floating iOS tab bar at rest (see KAV note above).
              paddingBottom: spacing.md + floatingInset,
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}
          >
            <MicButton active={voiceActive} disabled={micDisabled} onPress={voice.toggle} />
            <TextInput
              value={voiceActive ? '' : draft}
              onChangeText={setDraft}
              placeholder={voiceActive ? 'Voice mode — speak to IRIS' : 'Ask IRIS anything…'}
              placeholderTextColor={palette.faint}
              multiline
              editable={!isResponding && !voiceActive}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                borderRadius: radii.pill,
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: palette.text,
                paddingHorizontal: spacing.lg,
                paddingTop: 12,
                paddingBottom: 12,
                fontSize: 15,
              }}
              onSubmitEditing={dispatch}
              returnKeyType="send"
              // multiline defaults to newline-on-return, which made the
              // "send"-labeled return key insert line breaks instead of sending.
              submitBehavior="submit"
            />
            <Pressable
              onPress={dispatch}
              disabled={!canSend}
              hitSlop={8}
              style={{ paddingBottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
            >
              <Ionicons
                name="arrow-up-circle"
                size={36}
                color={canSend ? palette.accent : 'rgba(255,255,255,0.25)'}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
