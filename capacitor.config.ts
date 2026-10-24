import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.borauai.app',
  appName: 'Bora Uai',
  webDir: 'dist',
  server: {
    url: 'https://borauai.com',
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
