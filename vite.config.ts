import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' permite controlar manualmente quando o update é aplicado.
      // O hook usePWAUpdate envia SKIP_WAITING para ativar o novo SW.
      registerType: 'prompt',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'FunPlayB',
        short_name: 'FunPlayB',
        description: 'Jogo de perguntas bíblicas com ranking global',
        theme_color: '#1a1a3e',
        background_color: '#1a1a3e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Escuta mensagem SKIP_WAITING enviada pelo hook usePWAUpdate
        skipWaiting: false,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-cache' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    // Injeta a versão como constante global acessível via import.meta.env
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.1.0'),
  },
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
});
