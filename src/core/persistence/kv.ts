import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// Local-first KV layer mirroring the iOS UserDefaults-JSON stores. AsyncStorage
// keeps the foundation runnable in Expo Go; swap to react-native-mmkv (sync,
// optionally encrypted) once the app moves fully to development builds.

export const kv = {
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* best-effort */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* best-effort */
    }
  },
};

/** Storage engine for zustand `persist`. */
export const zustandStorage = createJSONStorage(() => AsyncStorage);

// Canonical storage keys (kept in one place so writers can't drift).
export const StorageKeys = {
  preferences: 'jetsetter_preferences',
  travel: 'jetsetter_travel',
} as const;
