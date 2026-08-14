import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jogoperguntas.app',
  appName: 'Jogo Perguntas',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
