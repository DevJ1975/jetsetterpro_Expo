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
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    // No biometrics AND no way to enroll → can't gate; allow (with a UI note).
    if (!hasHardware && !enrolled) return true;

    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false, // allow passcode
      cancelLabel: 'Cancel',
    });
    if (res.success) return true;
    // If the platform reports no enrolled method, degrade open rather than lock out.
    return res.error === 'not_enrolled' || res.error === 'not_available';
  } catch {
    return false;
  }
}
