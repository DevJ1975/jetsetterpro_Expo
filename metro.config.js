// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK ships some CommonJS (.cjs) entrypoints — make sure Metro
// resolves them so `firebase/auth` (React Native persistence) links correctly.
config.resolver.sourceExts.push('cjs');

module.exports = config;
