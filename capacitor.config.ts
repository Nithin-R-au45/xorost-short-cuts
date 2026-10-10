import type { CapacitorConfig } from '@capacitor/cli';

// Xorost native shell: loads the published web app inside a native
// iOS/Android container. Update `server.url` after publishing, or set
// the CAPACITOR_SERVER_URL env var when running `npx cap sync`.
const config: CapacitorConfig = {
  appId: 'app.xorost',
  appName: 'Xorost',
  webDir: 'dist/client',
  server: {
    // The published Xorost URL. The native apps load this site.
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://xorost.lovable.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0F172A',
      showSpinner: false,
    },
  },
};

export default config;
