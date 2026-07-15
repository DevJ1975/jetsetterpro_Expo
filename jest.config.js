/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
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
  clearMocks: true,
};
