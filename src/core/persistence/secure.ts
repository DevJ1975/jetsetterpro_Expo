import * as SecureStore from 'expo-secure-store';

// Keychain (iOS) / Keystore (Android) — the RN analog of the iOS
// KeychainCredentials + VaultCrypto master key. Used, later, for the Document
// Vault encryption key and any at-rest secret hardening.
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
