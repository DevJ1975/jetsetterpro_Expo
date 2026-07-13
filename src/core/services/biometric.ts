import * as LocalAuthentication from 'expo-local-authentication';

// The RN analog of the iOS Document Vault's LocalAuthentication gate. Falls back
// to the device passcode; degrades open only when the device has NO auth method
// configured (so a simulator without biometrics/passcode isn't permanently locked).

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    // getEnrolledLevelAsync reports NONE only when there is NEITHER a biometric
    // NOR a device passcode — the one case where we can't gate at all and must
    // degrade open (so a bare simulator isn't permanently locked). SECRET
    // (passcode) or BIOMETRIC means there IS an auth method, so require it — a
    // passcode-only device must still gate the vault. (hasHardware/isEnrolled
    // don't see a passcode, so they can't be used for this.)
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;

    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false, // allow the device passcode as fallback
      cancelLabel: 'Cancel',
    });
    if (res.success) return true;
    // A genuine failure/cancel stays locked; only degrade open if the platform
    // still reports no usable method.
    return (
      res.error === 'not_enrolled' ||
      res.error === 'not_available' ||
      res.error === 'passcode_not_set'
    );
  } catch {
    return false;
  }
}
