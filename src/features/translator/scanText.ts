import * as ImagePicker from 'expo-image-picker';

// Camera text capture for the Translator: photo → on-device ML Kit text
// recognition → raw recognized text. Mirrors src/core/services/receiptScan.ts
// (the generic sibling of scanReceipt): ML Kit is a native module — absent in
// Expo Go / web / tests — loaded via the optional-require pattern so callers
// feature-detect with `isScanTextAvailable()`.

type RecognizerModule = { recognize: (uri: string) => Promise<{ text: string }> };

function loadRecognizer(): RecognizerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    return (mod?.default ?? mod) as RecognizerModule;
  } catch {
    return null;
  }
}

export function isScanTextAvailable(): boolean {
  return loadRecognizer() !== null;
}

/**
 * Full camera-scan flow. Returns null on cancel / permission denied /
 * unavailable / OCR failure; '' when OCR ran but found no text.
 */
export async function scanText(): Promise<string | null> {
  const recognizer = loadRecognizer();
  if (!recognizer) return null;
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;
  const uri = result.assets[0]?.uri;
  if (!uri) return null;
  try {
    const recognized = await recognizer.recognize(uri);
    return recognized?.text ?? '';
  } catch (e) {
    console.warn('[scanText] OCR failed:', e);
    return null;
  }
}
