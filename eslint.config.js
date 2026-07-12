// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // functions/ is Node (Cloud Functions) — linted by its own toolchain.
    ignores: ['dist/*', 'functions/*'],
  },
]);
