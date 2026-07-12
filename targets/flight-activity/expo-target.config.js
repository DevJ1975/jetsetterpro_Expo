/** @type {import('@bacons/apple-targets').Config} */
// Widget Extension hosting the Flight Live Activity. Activated by adding
// "@bacons/apple-targets" to app.json plugins, then `npx expo prebuild` on macOS.
module.exports = {
  type: 'widget',
  name: 'FlightActivity',
  icon: '../../assets/images/icon.png',
  deploymentTarget: '16.1',
  entitlements: {
    // Shared App Group so the app and widget can hand off data (placeholder id;
    // requires a real Apple Developer team to sign).
    'com.apple.security.application-groups': ['group.com.jetsetterpro.app'],
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
};
