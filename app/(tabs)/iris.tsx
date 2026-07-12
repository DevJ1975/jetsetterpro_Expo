import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { MicButton, VoiceBar } from '@/src/features/iris/voice/VoiceBar';
import { useIrisVoice } from '@/src/features/iris/voice/useIrisVoice';
import { composeGreeting } from '@/src/core/ai/iris/agent';
import { useIris } from '@/src/core/store/iris';
import { useIrisMemory } from '@/src/core/store/irisMemory';

export default function IrisScreen() {
  const router = useRouter();
  const messages = useIris((s) => s.messages);
  const streamingContent = useIris((s) => s.streamingContent);
  const isResponding = useIris((s) => s.isResponding);
  const send = useIris((s) => s.send);
  const clear = useIris((s) => s.clear);
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
  // then IRIS's final reply is read back aloud.
  const onUtterance = useCallback(
    async (text: string): Promise<string | null> => {
      await send(text);
      const msgs = useIris.getState().messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') return msgs[i].text;
      }
      return null;
    },
    [send],
  );
  const voice = useIrisVoice(onUtterance);
  const voiceActive = voice.state !== 'idle';

  // Stop the voice loop when leaving the tab so the mic never lingers.
  useFocusEffect(
    useCallback(() => {
      return () => voice.stop();
    }, [voice]),
  );

  const canSend = draft.trim().length > 0 && !isResponding && !voiceActive;
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
              <Pressable onPress={clear} hitSlop={10}>
                <Ionicons name="create-outline" size={24} color={palette.bright} />
              </Pressable>
              <Pressable onPress={() => router.push('/iris/memory')} hitSlop={10}>
                <Ionicons name="bookmark-outline" size={24} color={palette.bright} />
              </Pressable>
            </View>
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
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
              paddingBottom: spacing.md,
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}
          >
            <MicButton active={voiceActive} onPress={voice.toggle} />
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
            />
            <Pressable onPress={dispatch} disabled={!canSend} hitSlop={8} style={{ paddingBottom: 6 }}>
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
