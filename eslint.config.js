// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/ is Deno (Edge Functions) — linted/typechecked by its own toolchain.
    ignores: ['dist/*', 'supabase/*'],
  },
]);
