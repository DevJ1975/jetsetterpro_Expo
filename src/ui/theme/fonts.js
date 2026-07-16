// JetSetter Pro — brand font families.
//
// The iOS app renders display text in SF Pro **Rounded** (`design: .rounded`).
// SF Rounded is Apple-only, so the cross-platform brand face is Nunito — the
// closest rounded match — embedded at build time via the expo-font config
// plugin (see app.json). Embedded fonts are addressed by **PostScript name on
// iOS** and **file name on Android**, hence the per-platform resolution here.
// PostScript names verified from the TTF name tables.
import { Platform } from 'react-native';

const family = (postScript, fileName) =>
  Platform.select({ ios: postScript, android: fileName, default: fileName });

export const fonts = {
  rounded: {
    regular: family('Nunito-Regular', 'Nunito_400Regular'),
    medium: family('Nunito-Medium', 'Nunito_500Medium'),
    semibold: family('Nunito-SemiBold', 'Nunito_600SemiBold'),
    bold: family('Nunito-Bold', 'Nunito_700Bold'),
    extrabold: family('Nunito-ExtraBold', 'Nunito_800ExtraBold'),
  },
  // Monospaced face for flight idents, boarding-pass fields, times, and
  // countdowns — tokenized so screens stop re-deriving Platform.select per file.
  mono: family('Menlo', 'monospace'),
};

// Runtime registration map for expo-font's useFonts — keyed by the SAME
// per-platform names the tokens reference, so the faces resolve in every
// environment (dev clients built before the fonts were embedded, web, tests).
// On builds where the config plugin already embedded the fonts this is a
// cheap re-registration.
export const fontAssets = {
  [fonts.rounded.regular]: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  [fonts.rounded.medium]: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
  [fonts.rounded.semibold]: require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
  [fonts.rounded.bold]: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  [fonts.rounded.extrabold]: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
};

export default fonts;
