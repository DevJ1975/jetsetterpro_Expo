import * as SecureStore from 'expo-secure-store';

// Keychain (iOS) / Keystore (Android) — the RN analog of the iOS
// KeychainCredentials + VaultCrypto master key. Used for the Supabase session
// hardening and, later, the Document Vault encryption key.
export const secure = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

export const SecureKeys = {
  vaultMasterKey: 'com.jetsetterpro.vault.masterkey',
} as const;
