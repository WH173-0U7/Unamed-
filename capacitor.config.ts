import type { CapacitorConfig } from '@capacitor/cli';

// The Android app: the same game, packaged (see .github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: 'io.github.wh1730u7.darcvoyd',
  appName: 'DarcVoyd',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_darcvoyd', iconColor: '#b3261e' },
  },
};

export default config;
