/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
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
