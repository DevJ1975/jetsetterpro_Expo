// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // functions/ is Node (Cloud Functions) — linted by its own toolchain.
    // scripts/ are Node build tooling; *.generated.ts are vendored artifacts.
    ignores: ['dist/*', 'functions/*', 'scripts/*', '**/*.generated.ts'],
  },
]);
