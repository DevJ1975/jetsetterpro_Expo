import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Badge, Button, Card, Input, ListRow, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Chips } from '@/src/features/common/Chips';
import { deleteAccount, signOutUser } from '@/src/core/firebase/auth';
import { wipeAllRemote } from '@/src/core/firebase/firestore';
import { registerForPush, unregisterPush } from '@/src/core/services/push';
import { useLovedOnes } from '@/src/core/store/lovedOnes';
import { DistanceUnit, NotificationPrefKey, usePreferences } from '@/src/core/store/preferences';
import { clearAllLocalData } from '@/src/core/store/reset';
import { useSession } from '@/src/core/store/session';
import { useTravel } from '@/src/core/store/travel';
import { recordSignal, useTravelProfile } from '@/src/core/store/travelProfile';

/** Everything "Clear local data" wipes: the shared reset plus the stores this
 *  suite added (loved ones + learned travel signals — both PII, mirrors iOS). */
async function clearAllUserData(): Promise<void> {
  await clearAllLocalData();
  useLovedOnes.getState().removeAll();
  useTravelProfile.getState().resetAll();
}

// Settings — port of iOS Features/Settings/SettingsView.swift section
// structure: grouped cards with SectionLabels; each row is an icon well +
// label + control (ListRow), Switches on the accent track.

const DISTANCE_UNITS: readonly DistanceUnit[] = ['mi', 'km'] as const;
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const TRACK = { false: palette.elevated2, true: palette.accent } as const;

function RowIcon({ name }: { name: string }) {
  return <Ionicons name={name as never} size={18} color={palette.bright} />;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <SectionLabel>{label}</SectionLabel>
      <Card>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    name,
    homeAirport,
    homeCurrency,
    setProfile,
    reset,
    distanceUnit,
    setDistanceUnit,
    flightAlerts,
    tripReminders,
    weeklyExpenseReview,
    setNotification,
    irisLearning,
    setIrisLearning,
  } = usePreferences();
  const session = useSession();
  const lovedOnesCount = useLovedOnes((s) => s.contacts.length);

  const accountLine =
    session.status === 'signedIn'
      ? session.isAnonymous
        ? 'Guest — data saved on this device & synced'
        : (session.email ?? 'Signed in')
      : 'Offline — data saved on this device';

  const confirmClear = () => {
    Alert.alert('Clear local data?', 'Removes trips, expenses, passes, and IRIS memory from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearAllUserData() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete account & data?', 'This permanently deletes your account and all synced data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAccount(async () => {
            await wipeAllRemote();
            await clearAllUserData();
          });
          reset();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  const onCurrencyChange = (t: string) => {
    const code = t.toUpperCase();
    setProfile({ homeCurrency: code });
    // Learning signal: the traveler told us what currency they work in.
    if (code.length === 3) recordSignal('currencySet', code);
  };

  const onAirportChange = (t: string) => {
    const code = t.toUpperCase();
    setProfile({ homeAirport: code });
    // Learning signal: a complete IATA code reinforces home-airport confidence.
    if (/^[A-Z]{3}$/.test(code)) recordSignal('airportUsed', code);
  };

  const onFlightAlerts = (on: boolean) => {
    setNotification('flightAlerts', on);
    // Flight alerts ride on push — drop the token when off, re-register when on.
    if (on) void registerForPush();
    else void unregisterPush();
  };

  const toggleNotif = (key: NotificationPrefKey) => (on: boolean) => setNotification(key, on);

  const exportData = async () => {
    try {
      const { trips, expenses } = useTravel.getState();
      const payload = {
        app: 'JetSetter Pro',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        trips,
        expenses,
      };
      const uri = `${FileSystem.cacheDirectory}jetsetter-export.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export my data' });
      } else {
        Alert.alert('Export ready', `Saved to ${uri}`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not create the export file.');
    }
  };

  const rateApp = () =>
    Alert.alert('Thanks!', 'Ratings open with the App Store release — this build is still in beta.');

  const master = irisLearning.master;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Preferences & account" title="Settings" />

      {/* ── JetSetter Pro ── */}
      <View>
        <SectionLabel>JetSetter Pro</SectionLabel>
        <Card>
          <ListRow
            icon={<RowIcon name="diamond" />}
            title="Pro active"
            subtitle="Beta unlock — every feature enabled"
            right={<Badge tone="good" label="PRO" />}
          />
          <ListRow
            icon={<RowIcon name="pricetags" />}
            title="View plans"
            right={<Ionicons name="chevron-forward" size={16} color={palette.faint} />}
            onPress={() => router.push('/paywall' as never)}
            last
          />
        </Card>
      </View>

      {/* ── IRIS learning ── */}
      <Section label="IRIS Learning">
        <ListRow
          icon={<RowIcon name="sparkles" />}
          title="Let IRIS learn from my activity"
          subtitle="On-device only — never shared"
          right={<Switch value={master} onValueChange={(on) => setIrisLearning({ master: on })} trackColor={TRACK} thumbColor="#FFFFFF" />}
        />
        <View style={{ opacity: master ? 1 : 0.55 }} pointerEvents={master ? 'auto' : 'none'}>
          <ListRow
            icon={<RowIcon name="checkmark-circle" />}
            title="Learn from seats & check-ins"
            right={<Switch value={irisLearning.checkIns} disabled={!master} onValueChange={(on) => setIrisLearning({ checkIns: on })} trackColor={TRACK} thumbColor="#FFFFFF" />}
          />
          <ListRow
            icon={<RowIcon name="receipt" />}
            title="Learn from receipts & expenses"
            right={<Switch value={irisLearning.receipts} disabled={!master} onValueChange={(on) => setIrisLearning({ receipts: on })} trackColor={TRACK} thumbColor="#FFFFFF" />}
          />
          <ListRow
            icon={<RowIcon name="airplane" />}
            title="Learn from trips & flights"
            right={<Switch value={irisLearning.trips} disabled={!master} onValueChange={(on) => setIrisLearning({ trips: on })} trackColor={TRACK} thumbColor="#FFFFFF" />}
          />
        </View>
        <ListRow
          icon={<RowIcon name="library" />}
          title="What IRIS Has Learned"
          right={<Ionicons name="chevron-forward" size={16} color={palette.faint} />}
          onPress={() => router.push('/iris/profile')}
          last
        />
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          IRIS learns only on your device, from your own activity. Turn off any source, or wipe
          everything from the learned profile screen.
        </Text>
      </Section>

      {/* ── Travel ── */}
      <Section label="Travel">
        <View style={{ gap: spacing.lg }}>
          <Input label="Name" value={name} onChangeText={(t: string) => setProfile({ name: t })} autoCapitalize="words" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input
              label="Home airport"
              value={homeAirport}
              onChangeText={onAirportChange}
              autoCapitalize="characters"
              maxLength={4}
              style={{ flex: 1 }}
            />
            <Input
              label="Currency"
              value={homeCurrency}
              onChangeText={onCurrencyChange}
              autoCapitalize="characters"
              maxLength={3}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.overline, { color: palette.dim }]}>Distance unit</Text>
            <Chips
              options={DISTANCE_UNITS}
              value={distanceUnit}
              onChange={setDistanceUnit}
              labelOf={(u) => (u === 'mi' ? 'Miles' : 'Kilometers')}
            />
          </View>
        </View>
      </Section>

      {/* ── Notifications ── */}
      <Section label="Notifications">
        <ListRow
          icon={<RowIcon name="airplane" />}
          title="Flight alerts"
          subtitle="Delays, gates & departure windows"
          right={<Switch value={flightAlerts} onValueChange={onFlightAlerts} trackColor={TRACK} thumbColor="#FFFFFF" />}
        />
        <ListRow
          icon={<RowIcon name="calendar" />}
          title="Trip reminders"
          subtitle="Morning of first trip day"
          right={<Switch value={tripReminders} onValueChange={toggleNotif('tripReminders')} trackColor={TRACK} thumbColor="#FFFFFF" />}
        />
        <ListRow
          icon={<RowIcon name="cash" />}
          title="Weekly expense review"
          subtitle="Every Sunday evening"
          right={<Switch value={weeklyExpenseReview} onValueChange={toggleNotif('weeklyExpenseReview')} trackColor={TRACK} thumbColor="#FFFFFF" />}
          last
        />
      </Section>

      {/* ── Travel contacts ── */}
      <Section label="Travel Contacts">
        <ListRow
          icon={<RowIcon name="heart" />}
          title="Loved Ones"
          subtitle={`${lovedOnesCount} contact${lovedOnesCount === 1 ? '' : 's'}`}
          right={<Ionicons name="chevron-forward" size={16} color={palette.faint} />}
          onPress={() => router.push('/loved-ones')}
          last
        />
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          IRIS offers to text these contacts when your flight takes off and lands. You always tap
          Send — nothing is sent automatically.
        </Text>
      </Section>

      {/* ── Account ── */}
      <Section label="Account">
        <Text style={type.body}>{accountLine}</Text>
        {session.status === 'signedIn' && !session.isAnonymous ? (
          <Button
            title="Sign out"
            variant="secondary"
            size="md"
            onPress={() => signOutUser()}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Button title="Clear local data" variant="secondary" size="md" onPress={confirmClear} />
          <Button title="Delete account & data" variant="danger" size="md" onPress={confirmDelete} />
        </View>
      </Section>

      {/* ── Data & privacy ── */}
      <Section label="Data & Privacy">
        <ListRow
          icon={<RowIcon name="download" />}
          title="Export my data"
          subtitle="Share your trips & expenses as JSON"
          onPress={() => void exportData()}
        />
        <ListRow
          icon={<RowIcon name="lock-closed" />}
          title="Private by design"
          subtitle="Your data stays on-device; sync is yours to control"
          last
        />
      </Section>

      {/* ── About ── */}
      <Section label="About">
        <ListRow
          icon={<RowIcon name="pricetag" />}
          title="Version"
          right={<Text style={type.caption}>v{APP_VERSION}</Text>}
        />
        <ListRow
          icon={<RowIcon name="information-circle" />}
          title="About JetSetter Pro"
          right={<Ionicons name="chevron-forward" size={16} color={palette.faint} />}
          onPress={() => router.push('/about')}
        />
        <ListRow
          icon={<RowIcon name="star" />}
          title="Rate the app"
          onPress={rateApp}
          last
        />
      </Section>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        JetSetter Pro · v{APP_VERSION}
      </Text>
    </Screen>
  );
}
