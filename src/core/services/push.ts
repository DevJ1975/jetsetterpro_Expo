import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { auth } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/config';
import { db } from '@/src/core/firebase/firestore';

// Expo push registration: one token API for both platforms; the
// disruptionWatch Cloud Function sends via the Expo Push service (EAS holds
// the APNs key / FCM service account — no messaging secrets in functions).
// Tokens live at users/{uid}/pushTokens/{sanitized-token}.

function sanitizeTokenId(token: string): string {
  return token.replace(/[^\w-]/g, '_');
}

let lastRegistered: string | null = null;

export async function registerForPush(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!isFirebaseConfigured() || !uid) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('disruptions', {
        name: 'Flight disruptions',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token || token === lastRegistered) return;
    lastRegistered = token;

    await setDoc(doc(db, 'users', uid, 'pushTokens', sanitizeTokenId(token)), {
      token,
      platform: Platform.OS,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[push] register:', e);
  }
}

export async function unregisterPush(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!isFirebaseConfigured() || !uid || !lastRegistered) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', sanitizeTokenId(lastRegistered)));
    lastRegistered = null;
  } catch (e) {
    console.warn('[push] unregister:', e);
  }
}
