import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Input, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { deleteAccount, signOutUser } from '@/src/core/firebase/auth';
import { wipeAllRemote } from '@/src/core/firebase/firestore';
import { usePreferences } from '@/src/core/store/preferences';
import { clearAllLocalData } from '@/src/core/store/reset';
import { useSession } from '@/src/core/store/session';

export default function SettingsScreen() {
  const router = useRouter();
  const { name, homeAirport, homeCurrency, setProfile, reset } = usePreferences();
  const session = useSession();

  const accountLine =
    session.status === 'signedIn'
      ? session.isAnonymous
        ? 'Guest — data saved on this device & synced'
        : (session.email ?? 'Signed in')
      : 'Offline — data saved on this device';

  const confirmClear = () => {
    Alert.alert('Clear local data?', 'Removes trips, expenses, passes, and IRIS memory from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearAllLocalData() },
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
            await clearAllLocalData();
          });
          reset();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Preferences & account" title="Settings" />

      <Card style={{ gap: spacing.lg }}>
        <SectionLabel>Profile</SectionLabel>
        <Input label="Name" value={name} onChangeText={(t: string) => setProfile({ name: t })} autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label="Home airport"
            value={homeAirport}
            onChangeText={(t: string) => setProfile({ homeAirport: t.toUpperCase() })}
            autoCapitalize="characters"
            maxLength={4}
            style={{ flex: 1 }}
          />
          <Input
            label="Currency"
            value={homeCurrency}
            onChangeText={(t: string) => setProfile({ homeCurrency: t.toUpperCase() })}
            autoCapitalize="characters"
            maxLength={3}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Account</SectionLabel>
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
      </Card>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button title="Clear local data" variant="secondary" size="md" onPress={confirmClear} />
        <Button title="Delete account & data" variant="danger" size="md" onPress={confirmDelete} />
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        JetSetter Pro · v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </Screen>
  );
}
