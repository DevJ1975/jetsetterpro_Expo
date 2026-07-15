// Emergency Mode — RN port of iOS `EmergencyModeView` (DocumentVaultView.swift).
// Red-accent screen surfacing the critical trio — passport, travel insurance,
// and an emergency contact — entirely from on-device storage, so it works with
// no network and without the full vault unlock ceremony.

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, Input, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { formatDate } from '@/src/core/format';
import { DOC_COLORS } from '@/src/features/vaults/docStyle';
import {
  DOC_META,
  EmergencyContact,
  VaultDoc,
  getDocNumber,
  useVault,
} from '@/src/core/store/vault';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const RED = palette.bad;

export default function EmergencyScreen() {
  const docs = useVault((s) => s.docs);
  const contact = useVault((s) => s.emergencyContact);
  const setContact = useVault((s) => s.setEmergencyContact);

  const passport = docs.find((d) => d.type === 'passport');
  const insurance = docs.find((d) => d.type === 'insurance');

  // Decrypted numbers for the two critical docs — read from the device
  // keychain on mount (on-device, offline; no network involved).
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const doc of [passport, insurance]) {
        if (doc?.hasNumber) {
          const value = await getDocNumber(doc.id);
          if (value) entries.push([doc.id, value]);
        }
      }
      if (!cancelled && entries.length) setNumbers(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [passport, insurance]);

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Works offline" title="Emergency Mode" />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        {/* Red status strip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radii.card,
            backgroundColor: 'rgba(255,92,92,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,92,92,0.30)',
          }}
        >
          <Ionicons name="medical" size={22} color={RED} />
          <Text style={[type.body, { flex: 1, color: palette.text }]}>
            Critical travel info, readable without a connection. Numbers come from this device&apos;s
            encrypted keychain.
          </Text>
        </View>

        {passport ? (
          <EmergencyDocCard doc={passport} number={numbers[passport.id]} large />
        ) : (
          <MissingCard label="No passport in the vault yet" />
        )}

        {insurance ? (
          <EmergencyDocCard doc={insurance} number={numbers[insurance.id]} />
        ) : (
          <MissingCard label="No travel insurance in the vault yet" />
        )}

        <ContactCard contact={contact} onSave={setContact} />
      </View>
    </Screen>
  );
}

// ── Document cards ───────────────────────────────────────────────────────────

function EmergencyDocCard({ doc, number, large }: { doc: VaultDoc; number?: string; large?: boolean }) {
  const color = DOC_COLORS[doc.type];
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: `${color}1F`,
            borderWidth: 1,
            borderColor: `${color}33`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={DOC_META[doc.type].icon as never} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.sub}>{DOC_META[doc.type].label}</Text>
          <Text style={[type.caption, { marginTop: 2 }]}>{doc.name}</Text>
        </View>
        <Badge tone="bad" label="Offline" />
      </View>

      {doc.hasNumber ? (
        <Text
          selectable
          style={{
            fontFamily: MONO,
            fontSize: large ? 26 : 18,
            letterSpacing: large ? 2 : 1,
            color: palette.text,
            marginBottom: doc.expiry ? spacing.sm : 0,
          }}
        >
          {number ?? '—'}
        </Text>
      ) : (
        <Text style={[type.bodyDim, { marginBottom: doc.expiry ? spacing.sm : 0 }]}>
          No number stored for this document.
        </Text>
      )}

      {doc.expiry ? (
        <Text style={type.caption}>
          Expires {formatDate(doc.expiry, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      ) : null}
    </Card>
  );
}

function MissingCard({ label }: { label: string }) {
  return (
    <Card variant="outline">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name="alert-circle-outline" size={18} color={palette.faint} />
        <Text style={type.bodyDim}>{label}</Text>
      </View>
    </Card>
  );
}

// ── Emergency contact ────────────────────────────────────────────────────────

function ContactCard({
  contact,
  onSave,
}: {
  contact?: EmergencyContact;
  onSave: (c?: EmergencyContact) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');

  const startEdit = () => {
    setName(contact?.name ?? '');
    setPhone(contact?.phone ?? '');
    setEditing(true);
  };

  const save = () => {
    const n = name.trim();
    const p = phone.trim();
    if (n && p) onSave({ name: n, phone: p });
    setEditing(false);
  };

  const call = () => {
    if (!contact?.phone) return;
    void Linking.openURL(`tel:${contact.phone.replace(/[^\d+]/g, '')}`).catch(() => {});
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(255,92,92,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,92,92,0.30)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="call" size={18} color={RED} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.sub}>Emergency contact</Text>
          <Text style={[type.caption, { marginTop: 2 }]}>Reachable straight from this screen</Text>
        </View>
        {!editing ? (
          <Pressable
            onPress={startEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={contact ? 'Edit contact' : 'Add contact'}
          >
            <Ionicons name={contact ? 'pencil' : 'add-circle'} size={20} color={palette.bright} />
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={{ gap: spacing.md }}>
          <Input label="Name" placeholder="Jane Appleseed" value={name} onChangeText={setName} autoFocus />
          <Input
            label="Phone"
            placeholder="+1 415 555 0100"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Cancel" variant="secondary" size="sm" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button
              title="Save contact"
              size="sm"
              onPress={save}
              disabled={!name.trim() || !phone.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : contact ? (
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={type.body}>{contact.name}</Text>
            <Text style={{ fontFamily: MONO, fontSize: 18, color: palette.text, marginTop: 4 }} selectable>
              {contact.phone}
            </Text>
          </View>
          <Button
            title={`Call ${contact.name}`}
            variant="danger"
            size="md"
            icon={<Ionicons name="call" size={16} color="#FFF" />}
            onPress={call}
          />
        </View>
      ) : (
        <Text style={type.bodyDim}>
          Add a contact so their number is one tap away — even with no signal for data.
        </Text>
      )}
    </Card>
  );
}
