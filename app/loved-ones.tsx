import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Chips } from '@/src/features/common/Chips';
import { EmptyState } from '@/src/features/common/EmptyState';
import {
  LovedOne,
  RELATIONSHIPS,
  Relationship,
  dialDigits,
  useLovedOnes,
} from '@/src/core/store/lovedOnes';
import { recordSignal } from '@/src/core/store/travelProfile';

// Loved Ones — port of iOS Features/Settings/LovedOnesSettingsView.swift +
// LovedOnesMessenger.swift: the people IRIS offers to text on takeoff and
// landing. Messages are always drafted, never sent automatically.

const TRACK = { false: palette.elevated2, true: palette.accent } as const;

// iOS LovedOnesMessenger.message(for: .takeoff), flagged as a test.
const TEST_BODY = "✈️ Wheels up — I'll text you when I land. (Test message from JetSetter Pro)";

function openTestMessage(phone: string) {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${dialDigits(phone)}${sep}body=${encodeURIComponent(TEST_BODY)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open Messages', 'This device cannot send text messages.'),
  );
}

interface Draft {
  id?: string;
  name: string;
  phone: string;
  relationship: Relationship;
}

const EMPTY_DRAFT: Draft = { name: '', phone: '', relationship: 'Family' };

export default function LovedOnesScreen() {
  const contacts = useLovedOnes((s) => s.contacts);
  const add = useLovedOnes((s) => s.add);
  const update = useLovedOnes((s) => s.update);
  const remove = useLovedOnes((s) => s.remove);

  const [draft, setDraft] = useState<Draft | null>(null);

  // A plausible dial-able number has at least 7 digits (iOS canAddManualContact).
  const draftValid =
    draft != null && draft.name.trim().length > 0 && dialDigits(draft.phone).replace('+', '').length >= 7;

  const saveDraft = () => {
    if (!draft || !draftValid) return;
    if (draft.id) {
      const existing = contacts.find((c) => c.id === draft.id);
      if (existing) {
        update({ ...existing, name: draft.name.trim(), phone: draft.phone.trim(), relationship: draft.relationship });
      }
    } else {
      add({
        name: draft.name,
        phone: draft.phone,
        relationship: draft.relationship,
        notifyOnTakeoff: true,
        notifyOnLanding: true,
      });
      // Learning signal: the traveler keeps this kind of person in the loop.
      recordSignal('contactAdded', draft.relationship);
    }
    setDraft(null);
  };

  const confirmRemove = (contact: LovedOne) =>
    Alert.alert(`Remove ${contact.name}?`, 'They will no longer get takeoff & landing texts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(contact.id) },
    ]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="Travel contacts"
        title="Loved Ones"
        right={
          <Pressable onPress={() => setDraft(EMPTY_DRAFT)} hitSlop={10}>
            <Ionicons name="add-circle" size={28} color={palette.accent} />
          </Pressable>
        }
      />

      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <Text style={type.bodyDim}>
          IRIS can text your loved ones on takeoff & landing — messages are drafted for you to
          send. Nothing goes out without your tap.
        </Text>
      </Card>

      {contacts.length === 0 ? (
        <Card>
          <EmptyState
            icon="heart"
            title="No contacts yet"
            subtitle="Add the people you'd like IRIS to text when your flight takes off and lands."
            actionLabel="Add a loved one"
            onAction={() => setDraft(EMPTY_DRAFT)}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {contacts.map((c) => (
            <Card key={c.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.sub} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                    {c.relationship} · {c.phone}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDraft({ id: c.id, name: c.name, phone: c.phone, relationship: c.relationship })}
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={18} color={palette.bright} />
                </Pressable>
                <Pressable onPress={() => confirmRemove(c)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={palette.bad} />
                </Pressable>
              </View>

              <View style={{ height: 1, backgroundColor: palette.line, marginVertical: spacing.md }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="airplane" size={14} color={palette.dim} />
                  <Text style={type.bodyDim}>Text on takeoff</Text>
                </View>
                <Switch
                  value={c.notifyOnTakeoff}
                  onValueChange={(on) => update({ ...c, notifyOnTakeoff: on })}
                  trackColor={TRACK}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="airplane" size={14} color={palette.dim} style={{ transform: [{ rotate: '90deg' }] }} />
                  <Text style={type.bodyDim}>Text on landing</Text>
                </View>
                <Switch
                  value={c.notifyOnLanding}
                  onValueChange={(on) => update({ ...c, notifyOnLanding: on })}
                  trackColor={TRACK}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Pressable
                onPress={() => openTestMessage(c.phone)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    marginTop: spacing.md,
                    paddingVertical: 10,
                    borderRadius: radii.control,
                    backgroundColor: palette.fillAccent,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="chatbubble-ellipses" size={15} color={palette.bright} />
                <Text style={[type.caption, { color: palette.bright, fontWeight: '700' }]}>
                  Send test message
                </Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      {/* ── Add / edit sheet ── */}
      <Modal visible={draft != null} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View
            style={{
              backgroundColor: palette.elevated,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              padding: spacing.xl,
              paddingBottom: spacing.xxxl,
              gap: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => setDraft(null)} hitSlop={10} style={{ width: 64 }}>
                <Text style={[type.body, { color: palette.bright }]}>Cancel</Text>
              </Pressable>
              <Text style={[type.sub, { flex: 1, textAlign: 'center' }]}>
                {draft?.id ? 'Edit Loved One' : 'Add Loved One'}
              </Text>
              <Pressable
                onPress={saveDraft}
                disabled={!draftValid}
                hitSlop={10}
                style={{ width: 64, alignItems: 'flex-end' }}
              >
                <Text style={[type.body, { color: draftValid ? palette.bright : palette.faint, fontWeight: '700' }]}>
                  Save
                </Text>
              </Pressable>
            </View>

            {draft ? (
              <>
                <Input
                  label="Name"
                  value={draft.name}
                  placeholder="Alex Morgan"
                  autoCapitalize="words"
                  onChangeText={(t: string) => setDraft({ ...draft, name: t })}
                />
                <Input
                  label="Phone"
                  value={draft.phone}
                  placeholder="+1 415 555 0100"
                  keyboardType="phone-pad"
                  onChangeText={(t: string) => setDraft({ ...draft, phone: t })}
                />
                <View style={{ gap: spacing.sm }}>
                  <Text style={[type.overline, { color: palette.dim }]}>Relationship</Text>
                  <Chips
                    options={RELATIONSHIPS}
                    value={draft.relationship}
                    onChange={(r) => setDraft({ ...draft, relationship: r })}
                  />
                </View>
                {draft.phone.length > 0 && !draftValid && draft.name.trim().length > 0 ? (
                  <Text style={[type.caption, { color: palette.warn }]}>
                    Enter a dialable phone number (at least 7 digits).
                  </Text>
                ) : null}
                <Button title={draft.id ? 'Save changes' : 'Add contact'} size="lg" onPress={saveDraft} disabled={!draftValid} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
