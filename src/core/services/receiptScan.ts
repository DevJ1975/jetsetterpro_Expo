import * as ImagePicker from 'expo-image-picker';
import { ParsedReceipt, parseReceiptText } from './receiptParse';

// Receipt scanning: camera/library photo → on-device ML Kit text recognition
// → heuristic parse. Free, offline, and receipts never leave the device.
// ML Kit is a native module (absent in Expo Go / web / tests) — loaded via
// the optional-require pattern like liveActivity.ts, so callers can feature-
// detect with `isReceiptScanAvailable()`.

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

export function isReceiptScanAvailable(): boolean {
  return loadRecognizer() !== null;
}

async function pickImage(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Full scan flow. Returns null on cancel/unavailable; {} when OCR found nothing useful. */
export async function scanReceipt(source: 'camera' | 'library'): Promise<ParsedReceipt | null> {
  const recognizer = loadRecognizer();
  if (!recognizer) return null;
  const uri = await pickImage(source);
  if (!uri) return null;
  try {
    const result = await recognizer.recognize(uri);
    return parseReceiptText(result?.text ?? '');
  } catch (e) {
    console.warn('[receiptScan] OCR failed:', e);
    return null;
  }
}
