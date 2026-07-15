// Identity & Trusted Traveler — RN rebuild of iOS `IdentityVaultView.swift`.
// A LINKS HUB, not storage: three gradient hero cards (Digital Driver's
// License with a searchable state picker, CLEAR, TSA PreCheck / Global Entry)
// over a "My numbers" section holding the stored KTN/Global Entry credentials.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Card, Input, ListRow, SectionLabel, palette, radii, shadows, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { IconWell } from '@/src/features/common/IconWell';
import { formatDate } from '@/src/core/format';
import {
  APPLE_WALLET_ID_GUIDE_URL,
  APPLE_WALLET_ID_LIST_URL,
  DEFAULT_MDL_STATE,
  MDL_STATES,
  MdlState,
  findMdlState,
} from '@/src/features/vaults/mdlStates';
import { IDENTITY_META, useIdentity } from '@/src/core/store/identity';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const DL_GRADIENT = ['#0A57C2', '#3B9EF0'] as const; // iOS #0066CC → #3B9EF0
const CLEAR_GRADIENT = ['#04294D', '#006FBA'] as const; // CLEAR navy (iOS #003C71 → #006FBA)
const TTP_GRADIENT = ['#7A4E10', '#B07A2E', '#DCA646'] as const; // gold

const open = (url: string) => {
  void WebBrowser.openBrowserAsync(url).catch(() => {});
};

export default function IdentityScreen() {
  const router = useRouter();
  const credentials = useIdentity((s) => s.credentials);
  const remove = useIdentity((s) => s.remove);
  const mdlState = useIdentity((s) => s.mdlState);
  const setMdlState = useIdentity((s) => s.setMdlState);

  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = findMdlState(mdlState) ?? findMdlState(DEFAULT_MDL_STATE)!;

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="Digital ID · CLEAR · PreCheck · Global Entry"
        title="Identity & Trusted Traveler"
        right={
          <Pressable onPress={() => router.push('/add-identity')} hitSlop={12}>
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
        {/* ── 1 · Digital Driver's License ─────────────────────────────── */}
        <View>
          <HubLabel icon="card" text="Digital Driver's License" />
          <HeroCard colors={DL_GRADIENT}>
            <HeroHeader
              icon="card"
              title="Apple Wallet ID"
              caption="Add your driver's license or state ID to Apple Wallet to breeze through TSA at supported airports."
            />

            {/* State picker row */}
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.stateRow, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.stateKicker}>STATE</Text>
                <Text style={styles.stateName}>{selected.name}</Text>
              </View>
              {selected.live ? <LivePill /> : null}
              <Ionicons name="chevron-expand" size={14} color="rgba(255,255,255,0.75)" />
            </Pressable>

            <ActionRow
              icon="wallet"
              title="How to add your ID to Wallet"
              subtitle="Step-by-step guide from Apple"
              emphasized
              onPress={() => open(APPLE_WALLET_ID_GUIDE_URL)}
            />
            <ActionRow
              icon="information-circle"
              title={`${selected.name} mobile ID info`}
              subtitle={selected.issuer ?? "Apple's supported-states list"}
              onPress={() => open(selected.infoUrl ?? APPLE_WALLET_ID_LIST_URL)}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Ionicons name="bulb" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.footnote}>
                Issuance happens through your state DMV — Apple Wallet then receives the pass.
              </Text>
            </View>
          </HeroCard>
        </View>

        {/* ── 2 · CLEAR ────────────────────────────────────────────────── */}
        <View>
          <HubLabel icon="eye" text="CLEAR" />
          <HeroCard colors={CLEAR_GRADIENT}>
            <HeroHeader
              icon="eye"
              title="CLEAR Plus"
              caption="Skip the security line at 100+ US airports with biometric verification."
            />
            <ActionRow
              icon="phone-portrait"
              title="Open CLEAR"
              subtitle="Verify your identity"
              emphasized
              onPress={() => open('https://www.clearme.com')}
            />
            <ActionRow
              icon="person-add"
              title="Enroll in CLEAR Plus"
              subtitle="See pricing & free-trial offers"
              onPress={() => open('https://www.clearme.com/enroll')}
            />
          </HeroCard>
        </View>

        {/* ── 3 · TSA PreCheck / Global Entry ──────────────────────────── */}
        <View>
          <HubLabel icon="shield-checkmark" text="TSA PreCheck & Global Entry" />
          <HeroCard colors={TTP_GRADIENT}>
            <HeroHeader
              icon="shield-checkmark"
              title="Trusted Traveler Programs"
              caption="TSA PreCheck speeds up US screening. Global Entry adds expedited customs on re-entry."
            />
            <ActionRow
              icon="globe"
              title="Apply / renew — TTP portal"
              subtitle="Trusted Traveler Programs (CBP)"
              emphasized
              onPress={() => open('https://ttp.cbp.dhs.gov/')}
            />
            <ActionRow
              icon="calendar"
              title="Schedule TSA PreCheck enrollment"
              subtitle="Universal Enroll Center"
              onPress={() => open('https://universalenroll.dhs.gov/programs/tsa-precheck')}
            />
          </HeroCard>
        </View>

        {/* ── My numbers (stored credentials) ──────────────────────────── */}
        <View>
          <SectionLabel>My numbers</SectionLabel>
          {credentials.length === 0 ? (
            <Card variant="outline">
              <Pressable
                onPress={() => router.push('/add-identity')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
              >
                <IconWell name="barcode" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={type.sub}>Add a traveler number</Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>
                    KTN, Global Entry / PASSID, CLEAR, NEXUS, Redress — kept for quick copy at booking.
                  </Text>
                </View>
                <Ionicons name="add-circle" size={22} color={palette.accent} />
              </Pressable>
            </Card>
          ) : (
            <Card>
              {credentials.map((c, i) => (
                <ListRow
                  key={c.id}
                  last={i === credentials.length - 1}
                  icon={<IconWell name={IDENTITY_META[c.kind].icon} size={18} />}
                  title={IDENTITY_META[c.kind].label}
                  subtitle={c.expiration ? `Exp ${formatDate(c.expiration)}` : undefined}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Text style={{ fontFamily: MONO, fontSize: 14, color: palette.text }}>{c.number}</Text>
                      <Pressable
                        onPress={() =>
                          Alert.alert('Remove credential?', IDENTITY_META[c.kind].label, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => remove(c.id) },
                          ])
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={palette.faint} />
                      </Pressable>
                    </View>
                  }
                />
              ))}
            </Card>
          )}
        </View>
      </View>

      <StatePickerSheet
        visible={pickerOpen}
        selectedCode={selected.code}
        onSelect={(s) => {
          setMdlState(s.code);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

// ── Hero-card building blocks ────────────────────────────────────────────────

function HubLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
      <Ionicons name={icon as never} size={12} color={palette.bright} />
      <Text style={[type.overline, { color: palette.bright }]}>{text}</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: palette.line, marginLeft: spacing.sm }} />
    </View>
  );
}

function HeroCard({ colors, children }: { colors: readonly [string, string, ...string[]]; children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { borderRadius: radii.card, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
        shadows.card,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

function HeroHeader({ icon, title, caption }: { icon: string; title: string; caption: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={styles.heroIcon}>
        <Ionicons name={icon as never} size={26} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  emphasized,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  emphasized?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: emphasized ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.12)' },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon as never} size={16} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.actionSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="arrow-up" size={13} color="rgba(255,255,255,0.75)" style={{ transform: [{ rotate: '45deg' }] }} />
    </Pressable>
  );
}

function LivePill() {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(29,185,125,0.25)',
        borderWidth: 1,
        borderColor: 'rgba(29,185,125,0.6)',
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: '#7CF0C0' }}>LIVE</Text>
    </View>
  );
}

// ── Searchable state picker sheet ────────────────────────────────────────────

function StatePickerSheet({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode: string;
  onSelect: (s: MdlState) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MDL_STATES;
    return MDL_STATES.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q);
  }, [query]);

  const live = filtered.filter((s) => s.live);
  const comingSoon = filtered.filter((s) => !s.live);

  const row = (s: MdlState) => (
    <Pressable
      key={s.code}
      onPress={() => onSelect(s)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: 12,
          borderBottomWidth: 0.5,
          borderBottomColor: palette.separator,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{s.name}</Text>
        {s.issuer ? <Text style={[type.caption, { marginTop: 2 }]}>{s.issuer}</Text> : null}
      </View>
      {s.live ? <Badge tone="good" label="Live" /> : null}
      {s.code === selectedCode ? (
        <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
      ) : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,5,10,0.6)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            maxHeight: '78%',
            backgroundColor: palette.elevated,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            borderWidth: 1,
            borderColor: palette.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={[type.heading, { flex: 1 }]}>Select state</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color={palette.dim} />
            </Pressable>
          </View>

          <Input
            placeholder="Search states…"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            {live.length > 0 ? (
              <>
                <Text style={[type.overline, { marginBottom: spacing.sm }]}>Live in Apple Wallet</Text>
                {live.map(row)}
              </>
            ) : null}
            {comingSoon.length > 0 ? (
              <>
                <Text style={[type.overline, { marginTop: live.length ? spacing.lg : 0, marginBottom: spacing.sm }]}>
                  Not yet in Apple Wallet
                </Text>
                {comingSoon.map(row)}
              </>
            ) : null}
            {filtered.length === 0 ? (
              <Text style={[type.bodyDim, { textAlign: 'center', paddingVertical: spacing.xl }]}>
                No states match “{query.trim()}”.
              </Text>
            ) : null}

            <Pressable
              onPress={() => open(APPLE_WALLET_ID_LIST_URL)}
              style={{ paddingVertical: spacing.lg, marginBottom: spacing.xl }}
              hitSlop={6}
            >
              <Text style={[type.caption, { color: palette.bright }]}>
                Don&apos;t see your state live yet? See Apple&apos;s up-to-date list →
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroTitle: { fontSize: 17, fontWeight: '700' as const, color: '#FFFFFF' },
  heroCaption: { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 3, lineHeight: 16 },
  stateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stateKicker: { fontSize: 9, fontWeight: '800' as const, letterSpacing: 1.5, color: 'rgba(255,255,255,0.65)' },
  stateName: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF', marginTop: 2 },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.control,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionTitle: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  actionSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  footnote: { fontSize: 11, color: 'rgba(255,255,255,0.7)', flex: 1, lineHeight: 15 },
};
