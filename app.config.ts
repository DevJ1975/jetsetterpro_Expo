import { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config layer over app.json. Everything static lives in app.json; this
// hook is where build-time values from the environment (EAS `env` / `.env`)
// would be injected into `extra` if needed. Firebase config is read directly
// from EXPO_PUBLIC_* vars (see src/core/firebase/config.ts), so nothing is
// required here today.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'JetSetter Pro',
  slug: config.slug ?? 'jetsetter-pro',
});
