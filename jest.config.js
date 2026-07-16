const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Extend (not replace) the preset's transform so firebase's .mjs files
  // (@firebase/util postinstall) run through babel like .js.
  transform: {
    ...preset.transform,
    '\\.m[jt]sx?$': preset.transform['\\.[jt]sx?$'],
  },
  // Reanimated 4 delegates to react-native-worklets; its jest resolver swaps
  // in the JS implementation so components animate (inertly) under test.
  resolver: 'react-native-worklets/jest/resolver.js',
  // Mirror the tsconfig `@/*` path alias so tests resolve source the same way Metro does.
  moduleNameMapper: {
    '^react-native-vector-icons$': '@expo/vector-icons',
    '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/*.test.ts?(x)'],
  // functions/ is a separate Cloud Functions package with its own toolchain.
  testPathIgnorePatterns: ['/node_modules/', '/functions/', '/dist/'],
  // jest-expo's default allowlist + firebase (ships untransformed ESM).
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|firebase|@firebase))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  clearMocks: true,
};
