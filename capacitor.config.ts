import type { CapacitorConfig } from '@capacitor/cli';

// The Android app: the same game, packaged (see .github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: 'io.github.wh1730u7.darcvoyd',
  appName: 'DarcVoyd',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: { allowMixedContent: false },
  // The app plays the live game from the website, so every update reaches the
  // phone the next time it's opened (no new download). Only changes to the app
  // itself (new kinds of notification, say) need a new APK; the game says so.
  server: { url: 'https://wh173-0u7.github.io/Unamed-/', androidScheme: 'https' },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_darcvoyd', iconColor: '#b3261e' },
  },
};

export default config;
