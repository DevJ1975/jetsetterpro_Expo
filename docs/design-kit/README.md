# JetSetter Pro — React Native / Expo UI Kit

The complete JetSetter Pro design system as drop-in React Native code: color tokens, type scale, spacing/radii/shadows, and 10 core components styled to match the shipped app screens.

## Install

1. Copy the \`rn-expo-kit/\` folder into your Expo project (e.g. as \`src/ui/\`).
2. The kit is dependency-free except the hero gradient:
   \`\`\`
   npx expo install expo-linear-gradient
   \`\`\`
3. Import from one place:
   \`\`\`js
   import { palette, gradients, type, spacing, radii, shadows, Button, Card, Badge } from './src/ui';
   \`\`\`

## What's inside

- \`theme/colors.js\` — full palette + gradient stop arrays (blues = product UI; gold family = marketing surfaces only)
- \`theme/typography.js\` — system-font type scale (display → overline)
- \`theme/spacing.js\` / \`radii.js\` / \`shadows.js\` — 4pt grid, corner radii, dark-UI shadows + accent glow
- \`components/\` — Button (4 variants × 3 sizes), Card (solid/glass/outline), Badge, StatusDot (pulsing), ListRow, ScreenHeader, Input, ProgressBar, TabBar, SectionLabel
- \`example/ExampleScreen.js\` — a working screen composing all of it
- \`assets/\` — brand mark SVG + app icons (use \`react-native-svg\` / \`expo-image\` as needed)

## Design rules (the 5 that matter)

1. **Dark-first.** Base is \`palette.ink\` or the \`gradients.hero\` wash. Never pure black cards — use \`surface\`/\`surfaceGlass\` with a \`line\` hairline.
2. **One accent.** Blue (\`accent\`/\`bright\`) is the only interactive color. Semantic colors (good/warn/bad) are for status only, never buttons (except \`danger\`).
3. **System font.** Heavy weights (700–800) with tight tracking for display; \`overline\` style (11px / +1.6 tracking / uppercase) for kickers.
4. **44pt hit targets.** Buttons ≥ 44 high (\`md\`), rows ≥ 56.
5. **Gold is marketing-only.** \`champagne/gold/deepGold\` belong to App Store & brochure surfaces, not in-app UI.

## Icon guidance

Use your icon set at 15–24px stroke ~2 on \`bright\`/\`dim\`, inside 40×40 tinted wells (\`fillAccent\` + \`line\` border, radius 12) for list rows.
